// netlify/functions/orm.js
// Proxies OpenRailwayMap tiles via your domain.
// Works whether request path is /api/orm/... or /.netlify/functions/orm/...

const ORIGIN = 'https://tile.openrailwaymap.org';

exports.handler = async (event) => {
  try {
    // Get pathname without query
    const url = new URL(event.rawUrl || (`https://x${event.path}`));
    let p = url.pathname;

    // Accept either prefix
    p = p.replace(/^\/\.netlify\/functions\/orm\//, '');
    p = p.replace(/^\/api\/orm\//, '');

    // Expect e.g. standard/5/27/19.png
    const ok = /^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(p);
    if (!ok) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: `Bad path: ${p}\nExpected /standard|maxspeed|signals/{z}/{x}/{y}.png`
      };
    }

    const upstream = `${ORIGIN}/${p}`;
    const resp = await fetch(upstream, { headers: { 'User-Agent': 'RailOps Proxy' } });

    // Pass through status; encode body as base64
    const ab = await resp.arrayBuffer();
    return {
      statusCode: resp.status,
      headers: {
        'Content-Type': resp.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(ab).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'ORM proxy error: ' + (e?.message || String(e))
    };
  }
};