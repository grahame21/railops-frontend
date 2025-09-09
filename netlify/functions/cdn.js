// netlify/functions/cdn.js
// Proxy a whitelisted set of assets through your own origin.
// Usage:
//   /api/cdn/ol.js
//   /api/cdn/ol.css

const MAP = {
  'ol.js':  'https://cdn.jsdelivr.net/npm/ol@9.1.0/dist/ol.js',
  'ol.css': 'https://cdn.jsdelivr.net/npm/ol@9.1.0/ol.css'
};

const UA = 'RailOps CDN Proxy (+https://traintracker2-0.netlify.app)';

exports.handler = async (event) => {
  try {
    // event.path is usually "/.netlify/functions/cdn/ol.js" or "/api/cdn/ol.js"
    const m = event.path.match(/(?:\/cdn\/)([^\/]+)$/);
    const key = m && m[1];
    const upstream = key && MAP[key];

    if (!upstream) {
      return txt(404, 'Not found. Try /api/cdn/ol.js or /api/cdn/ol.css');
    }

    const resp = await fetch(upstream, {
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow'
    });

    if (!resp.ok) return txt(resp.status, `Upstream ${resp.status} for ${key}`);

    const ct = resp.headers.get('content-type') || (key.endsWith('.css') ? 'text/css' : 'application/javascript');
    const buf = Buffer.from(await resp.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return txt(502, 'CDN proxy error: ' + (e?.message || String(e)));
  }
};

function txt(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    body
  };
}