// netlify/functions/cdn.js
// Serves vetted assets through your own domain: /api/cdn/ol.js, /api/cdn/ol.css

const MAP = {
  'ol.js':  'https://cdn.jsdelivr.net/npm/ol@9.1.0/dist/ol.js',
  'ol.css': 'https://cdn.jsdelivr.net/npm/ol@9.1.0/ol.css',
};

exports.handler = async (event) => {
  try {
    const m = event.path.match(/\/cdn\/([^\/]+)$/);
    const key = m && m[1];
    const upstream = key && MAP[key];
    if (!upstream) return text(404, 'Try /api/cdn/ol.js or /api/cdn/ol.css');

    const r = await fetch(upstream, { redirect: 'follow', headers: { 'Accept': '*/*' } });
    if (!r.ok) return text(r.status, `Upstream responded ${r.status} for ${key}`);

    const ct = r.headers.get('content-type') || (key.endsWith('.css') ? 'text/css' : 'application/javascript');
    const buf = Buffer.from(await r.arrayBuffer());

    return {
      statusCode: 200,
      headers: {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return text(502, 'CDN proxy error: ' + (e?.message || String(e)));
  }
};

function text(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
    body,
  };
}