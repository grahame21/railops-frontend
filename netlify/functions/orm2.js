// netlify/functions/orm2.js
// Query-param proxy: /api/orm2?path=standard/{z}/{x}/{y}.png
const ORIGIN = 'https://tile.openrailwaymap.org';

exports.handler = async (event) => {
  try {
    const path = (event.queryStringParameters && event.queryStringParameters.path) || '';
    // basic validation
    if (!/^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(path)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: `Bad or missing "path". Try ?path=standard/5/27/19.png (got "${path}")`
      };
    }

    const upstream = `${ORIGIN}/${path}`;
    const r = await fetch(upstream, { headers: { 'User-Agent': 'RailOps Proxy' }, redirect: 'follow' });

    const ct = r.headers.get('content-type') || 'image/png';
    const ab = await r.arrayBuffer();

    return {
      statusCode: r.status,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(ab).toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'ORM2 proxy error: ' + (e?.message || String(e))
    };
  }
};