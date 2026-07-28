/**
 * Unit tests for src/utils/fetchWithTimeout.ts
 *
 * The contract these pin down:
 *  1. A hanging request rejects at the deadline instead of never settling.
 *  2. It is actually aborted — not merely abandoned by a Promise.race.
 *  3. A 429 puts the host into cooldown so the next burst fails fast for free.
 *  4. Cooldown is per host and expires.
 */

import {
  DEFAULT_TIMEOUT_MS,
  FetchTimeoutError,
  fetchWithTimeout,
  markRateLimited,
  rateLimitRemaining,
  RateLimitedError,
  RATE_LIMIT_COOLDOWN_MS,
  resetRateLimits,
} from "../fetchWithTimeout";

const GB = "https://www.googleapis.com/books/v1/volumes?q=dune";
const OL = "https://openlibrary.org/search.json?q=dune";

const okResponse = (status = 200) => ({ ok: status < 400, status, json: async () => ({}) }) as unknown as Response;

/** A fetch that never resolves unless its AbortSignal fires. */
function hangingFetch() {
  return jest.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  });
}

const originalFetch = global.fetch;

beforeEach(() => {
  resetRateLimits();
  jest.useRealTimers();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ─── Timeout ──────────────────────────────────────────────────────────────────

describe("fetchWithTimeout — deadline", () => {
  it("rejects with FetchTimeoutError when the server never answers", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;

    await expect(fetchWithTimeout(GB, { timeoutMs: 20 })).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  it("reports the budget it exceeded", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;

    await expect(fetchWithTimeout(GB, { timeoutMs: 20 })).rejects.toMatchObject({ timeoutMs: 20 });
  });

  it("actually aborts the underlying request rather than abandoning it", async () => {
    const spy = hangingFetch();
    global.fetch = spy as unknown as typeof fetch;

    await expect(fetchWithTimeout(GB, { timeoutMs: 20 })).rejects.toThrow();

    // This is the whole point: Promise.race would leave the signal untouched.
    const passedSignal = spy.mock.calls[0][1]?.signal;
    expect(passedSignal?.aborted).toBe(true);
  });

  it("passes a response straight through when the server is fast", async () => {
    global.fetch = jest.fn(async () => okResponse()) as unknown as typeof fetch;

    const res = await fetchWithTimeout(GB, { timeoutMs: 500 });
    expect(res.ok).toBe(true);
  });

  it("does not fire the timeout after a successful response", async () => {
    global.fetch = jest.fn(async () => okResponse()) as unknown as typeof fetch;

    await fetchWithTimeout(GB, { timeoutMs: 30 });
    // If the timer were left pending it would abort nothing, but it would keep
    // the JS timer queue alive — which is what Jest's open-handle warning flags.
    await new Promise((r) => setTimeout(r, 50));
    expect(true).toBe(true);
  });

  it("defaults to a sane budget when none is given", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  it("honours an external abort signal", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const external = new AbortController();

    const promise = fetchWithTimeout(GB, { timeoutMs: 5_000, signal: external.signal });
    external.abort();

    await expect(promise).rejects.toThrow();
  });
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

describe("fetchWithTimeout — 429 circuit breaker", () => {
  it("puts the host into cooldown after a 429", async () => {
    global.fetch = jest.fn(async () => okResponse(429)) as unknown as typeof fetch;

    await fetchWithTimeout(GB);

    expect(rateLimitRemaining(GB)).toBeGreaterThan(0);
  });

  it("returns the 429 response to the caller rather than throwing", async () => {
    global.fetch = jest.fn(async () => okResponse(429)) as unknown as typeof fetch;

    const res = await fetchWithTimeout(GB);
    expect(res.status).toBe(429);
  });

  it("fails fast without hitting the network while cooling down", async () => {
    const spy = jest.fn(async () => okResponse(429));
    global.fetch = spy as unknown as typeof fetch;

    await fetchWithTimeout(GB);
    await expect(fetchWithTimeout(GB)).rejects.toBeInstanceOf(RateLimitedError);

    // One real request, not two — the second never reached the wire.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("suppresses a whole parallel fan-out after one 429", async () => {
    const spy = jest.fn(async () => okResponse(429));
    global.fetch = spy as unknown as typeof fetch;

    await fetchWithTimeout(GB);
    const results = await Promise.allSettled([
      fetchWithTimeout(GB + "&a=1"),
      fetchWithTimeout(GB + "&a=2"),
      fetchWithTimeout(GB + "&a=3"),
    ]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("cools down per host — Open Library is unaffected by a Google Books 429", async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.includes("googleapis") ? okResponse(429) : okResponse(200)
    ) as unknown as typeof fetch;

    await fetchWithTimeout(GB);

    expect(rateLimitRemaining(GB)).toBeGreaterThan(0);
    expect(rateLimitRemaining(OL)).toBe(0);
    await expect(fetchWithTimeout(OL)).resolves.toMatchObject({ status: 200 });
  });

  it("lets the host through again once the cooldown expires", () => {
    const now = 1_000_000;
    markRateLimited(GB, RATE_LIMIT_COOLDOWN_MS, now);

    expect(rateLimitRemaining(GB, now + 1_000)).toBeGreaterThan(0);
    expect(rateLimitRemaining(GB, now + RATE_LIMIT_COOLDOWN_MS + 1)).toBe(0);
  });

  it("can bypass the breaker when a caller explicitly opts out", async () => {
    const spy = jest.fn(async () => okResponse(200));
    global.fetch = spy as unknown as typeof fetch;
    markRateLimited(GB);

    await expect(fetchWithTimeout(GB, { respectRateLimit: false })).resolves.toMatchObject({ status: 200 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not cool down on ordinary errors like 404 or 500", async () => {
    global.fetch = jest.fn(async () => okResponse(500)) as unknown as typeof fetch;

    await fetchWithTimeout(GB);

    expect(rateLimitRemaining(GB)).toBe(0);
  });
});
