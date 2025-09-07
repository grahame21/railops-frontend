// Proxies OpenStreetMap tiles
exports.handler = async (event) => {
  try {
    const m = event.path.match(/\/osm\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) return { statusCode: 400, body: "Use /.netlify/functions/osm/{z}/{x}/{y}.png" };
    const [, z, x, y] = m;

    const upstream = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const resp = await fetch(upstream, { headers: { "User-Agent": "RailOps Netlify Proxy" } });
    if (!resp.ok) return { statusCode: resp.status, body: `Upstream ${resp.status} ${resp.statusText}` };

    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: "Proxy error: " + (e?.message || String(e)) };
  }
};