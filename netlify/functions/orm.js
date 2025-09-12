// netlify/functions/tile-orm.js
// Proxy OpenRailwayMap tiles through Netlify Functions

exports.handler = async (event) => {
  try {
    const m = event.path.match(/\/api\/tiles\/orm\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) {
      return { statusCode: 400, body: "Bad ORM tile path" };
    }
    const [, z, x, y] = m;
    const upstream = `https://tile.openrailwaymap.org/standard/${z}/${x}/${y}.png`;

    const r = await fetch(upstream, { redirect: "follow" });
    if (!r.ok) {
      return { statusCode: r.status, body: `Upstream ORM ${r.status}` };
    }
    const buf = Buffer.from(await r.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*"
      },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 502, body: "ORM fetch failed" };
  }
};