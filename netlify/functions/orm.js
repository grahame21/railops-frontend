// netlify/functions/orm.js
export async function handler(event) {
  try {
    // Path format: /orm/{style}/{z}/{x}/{y}.png
    const m = event.path.match(/\/orm\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) {
      return { statusCode: 400, body: "Bad path. Use /api/orm/standard/{z}/{x}/{y}.png" };
    }
    const [, style, z, x, y] = m;

    // Only allow known styles to avoid abuse
    const ALLOWED = new Set(["standard", "maxspeed", "signals"]);
    if (!ALLOWED.has(style)) {
      return { statusCode: 400, body: "Unknown style." };
    }

    const upstream = `https://tile.openrailwaymap.org/${style}/${z}/${x}/${y}.png`;
    const resp = await fetch(upstream, {
      headers: { "User-Agent": "RailOps/1.0 (Netlify proxy)" }
    });

    // Pass through errors from upstream
    if (!resp.ok) {
      return { statusCode: resp.status, body: `Upstream ${resp.status} ${resp.statusText}` };
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/png",
        // Cache tiles aggressively on CDN/Browser
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: "Proxy error: " + (e?.message || String(e)) };
  }
}