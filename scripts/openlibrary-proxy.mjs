import http from "node:http";

const PORT = Number(process.env.BOOKLIO_METADATA_PROXY_PORT ?? 8788);
const UPSTREAM = "https://openlibrary.org";

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, corsHeaders({ "content-type": "application/json" }));
    res.end(JSON.stringify({ error: "Missing request URL." }));
    return;
  }

  if (req.method !== "GET" && req.method !== "OPTIONS") {
    res.writeHead(405, corsHeaders({ allow: "GET, OPTIONS", "content-type": "application/json" }));
    res.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const target = `${UPSTREAM}${req.url}`;

  try {
    const upstream = await fetch(target, {
      headers: {
        accept: "application/json"
      },
      redirect: "follow"
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get("content-type") ?? "application/json";

    res.writeHead(
      upstream.status,
      corsHeaders({
        "content-type": contentType,
        "cache-control": upstream.headers.get("cache-control") ?? "no-store"
      })
    );
    res.end(body);
  } catch (error) {
    res.writeHead(502, corsHeaders({ "content-type": "application/json" }));
    res.end(
      JSON.stringify({
        error: "Failed to reach Open Library.",
        detail: error instanceof Error ? error.message : String(error)
      })
    );
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Booklio metadata proxy listening on http://127.0.0.1:${PORT}`);
});

function corsHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    ...extra
  };
}
