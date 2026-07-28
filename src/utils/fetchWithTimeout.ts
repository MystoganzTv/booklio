/**
 * fetchWithTimeout — every network call in Bookliz goes through here.
 *
 * Why this exists
 * ---------------
 * Bare `fetch` on React Native has no timeout. On a mobile network that accepts
 * the TCP connection but never answers (captive portals, dead cell edges, a
 * provider having a bad day) the promise never settles: the spinner spins
 * forever and the user has no way out but to kill the app.
 *
 * `Promise.race([fetch(url), timeout])` does not fix this. The race settles, but
 * the underlying request keeps running — socket held, radio awake, response
 * body still downloading into a result nobody will read. Only an AbortController
 * actually cancels it.
 *
 * Rate-limit circuit breaker
 * --------------------------
 * Google Books returns 429 once the daily quota is spent, and every subsequent
 * request still counts against it. The metadata pipeline fans out 6+ parallel
 * jobs per lookup, so one exhausted quota becomes a burst of doomed requests on
 * every search. After a 429 we stop calling that host for a cooldown window and
 * fail fast locally instead — callers already treat a failure as "no results",
 * so the UI degrades exactly as it would have, just instantly and for free.
 */

/** Thrown when the request exceeded its time budget. */
export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown when a host is in rate-limit cooldown and the call was skipped. */
export class RateLimitedError extends Error {
  readonly host: string;
  readonly retryAfterMs: number;
  constructor(host: string, retryAfterMs: number) {
    super(`Skipping ${host}: rate limited, retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "RateLimitedError";
    this.host = host;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Default budget. Long enough for a slow 3G round trip, short enough to not feel broken. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** How long to stop calling a host after it returns 429. */
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

export type FetchWithTimeoutOptions = RequestInit & {
  /** Time budget in ms. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Set false to bypass the circuit breaker for this call. Defaults to true. */
  respectRateLimit?: boolean;
};

// host → timestamp (ms) until which we refuse to call it
const cooldownUntil = new Map<string, number>();

function hostOf(url: string): string {
  // No URL polyfill guarantees on RN — parse the authority by hand.
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/.exec(url);
  return match ? match[1].toLowerCase() : url;
}

/** Remaining cooldown for a host in ms, or 0 if it is callable. */
export function rateLimitRemaining(url: string, now = Date.now()): number {
  const until = cooldownUntil.get(hostOf(url));
  if (!until) return 0;
  if (until <= now) {
    cooldownUntil.delete(hostOf(url));
    return 0;
  }
  return until - now;
}

/** Put a host into cooldown. Exported for tests and for callers that detect 429 themselves. */
export function markRateLimited(url: string, cooldownMs = RATE_LIMIT_COOLDOWN_MS, now = Date.now()): void {
  cooldownUntil.set(hostOf(url), now + cooldownMs);
}

/** Clear all cooldowns. Tests only. */
export function resetRateLimits(): void {
  cooldownUntil.clear();
}

/**
 * `fetch` with a hard time budget and real cancellation.
 *
 * Throws `FetchTimeoutError` on timeout and `RateLimitedError` when the host is
 * in cooldown. Every call site in this codebase already wraps network access in
 * try/catch returning an empty result, so both surface as "no results" — which
 * is the honest answer.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, respectRateLimit = true, signal, ...init } = options;

  if (respectRateLimit) {
    const remaining = rateLimitRemaining(url);
    if (remaining > 0) {
      if (__DEV__) console.log(`[NET] skipped (rate limited ${Math.ceil(remaining / 1000)}s): ${hostOf(url)}`);
      throw new RateLimitedError(hostOf(url), remaining);
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Honour a caller-supplied signal too, so screens can cancel on unmount.
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort);
  }

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 429) {
      markRateLimited(url);
      if (__DEV__) console.log(`[NET] 429 from ${hostOf(url)} — cooling down ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
    }
    return res;
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
