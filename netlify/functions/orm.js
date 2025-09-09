// netlify/functions/orm.js
// Proxies OpenRailwayMap tiles and includes a ?debug=1 mode to print diagnostics.

const ORIGIN = 'https://tile.openrailwaymap.org';

exports.handler = async (event) => {
  try {
    // Build a URL object (event.rawUrl is present on Netlify Functions)
    const raw = event.rawUrl || ('https://dummy' + event.path + (event.queryStringParameters ? ('?' + new URLSearchParams(event.queryStringParameters)) : ''));
    const reqUrl = new URL(raw);

    // Accept either prefix: /.netlify/functions/orm/...  OR /api/orm/...
    let p = reqUrl.pathname;
    p = p.replace(/^\/\.netlify\/functions\/orm\//, '');
    p = p.replace(/^\/api\/orm\//, '');

    // Allow only known layers (but don't block on regex while debugging)
    const isExpected = /^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(p);

    const upstream = `${ORIGIN}/${p}`;

    // If debug requested, short-circuit to show what we’re about to do
    if (reqUrl.searchParams.get('debug') === '1') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body:
`DEBUG
event.path: ${event.path}
event.rawUrl: ${event.rawUrl || '(none)'}
computed p: ${p}
expectedPathFormat: /{standard|maxspeed|signals}/{z}/{x}/{y}.png
regexMatch: ${isExpected}
upstream: ${upstream}
`
      };
    }

    // Fetch the upstream tile
    const r = await fetch(upstream, { headers: { 'User-Agent': 'RailOps Proxy' }, redirect: 'follow' });

    // Get content-type and body
    const ct = r.headers.get('content-type') || '';
    const ab = await r.arrayBuffer();
    const b64 = Buffer.from(ab).toString('base64');

    // If it's an image, return as base64
    if (ct.startsWith('image/')) {
      return {
        statusCode: r.status,
        headers: {
          'Content-Type': ct || 'image/png',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          'Access-Control-Allow-Origin': '*'
        },
        body: b64,
        isBase64Encoded: true
      };
    }

    // Otherwise, return a readable text diagnostic
    return {
      statusCode: r.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body:
`UPSTREAM NON-IMAGE RESPONSE
status: ${r.status}
content-type: ${ct}
requested: ${upstream}

(Sample of response body, base64-encoded):
${b64.slice(0, 400)} ...`
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'ORM proxy error: ' + (e && e.message ? e.message : String(e))
    };
  }
};