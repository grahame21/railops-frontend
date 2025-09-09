// Proxies OSM tiles via your domain.
// Usage: /.netlify/functions/osm/{z}/{x}/{y}.png
const ORIGIN = "https://tile.openstreetmap.org";

exports.handler = async (event) => {
  try {
    const upstreamPath = event.path.replace(/^\/\.netlify\/functions\/osm\//, "");
    if (!/^\d+\/\d+\/\d+\.png$/.test(upstreamPath)) {
      return { statusCode: 400, body: "Bad path. Use /{z}/{x}/{y}.png" };
    }
    const url = `${ORIGIN}/${upstreamPath}`;
    const resp = await fetch(url, { headers: { "User-Agent": "RailOps Proxy" } });
    const ab = await resp.arrayBuffer();
    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": resp.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*"
      },
      body: Buffer.from(ab).toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: "OSM proxy error: " + (e?.message || String(e)) };
  }
};