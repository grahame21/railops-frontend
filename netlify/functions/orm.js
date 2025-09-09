// netlify/functions/orm.js
// Proxies OpenRailwayMap tiles through your domain to bypass CSP/content blockers.
// Usage: /.netlify/functions/orm/standard/{z}/{x}/{y}.png

const ORIGIN = "https://tile.openrailwaymap.org";

exports.handler = async (event) => {
  try {
    // Expect paths like: /.netlify/functions/orm/standard/5/27/19.png
    const upstreamPath = event.path.replace(/^\/\.netlify\/functions\/orm\//, "");
    if (!/^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(upstreamPath)) {
      return { statusCode: 400, body: "Bad path. Try /standard/{z}/{x}/{y}.png" };
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
    return { statusCode: 500, body: "Proxy error: " + (e?.message || String(e)) };
  }
};