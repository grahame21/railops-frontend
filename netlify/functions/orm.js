const ORIGIN = 'https://tile.openrailwaymap.org';

exports.handler = async (event) => {
  try {
    const path = event.path.replace(/^\/api\/orm\//, ''); // thanks to /_redirects :splat
    if (!/^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(path)) {
      return { statusCode: 400, body: 'Bad path. Use /api/orm/standard/{z}/{x}/{y}.png' };
    }
    const r = await fetch(`${ORIGIN}/${path}`, { headers: { 'User-Agent': 'RailOps Proxy' } });
    const buf = Buffer.from(await r.arrayBuffer());
    return {
      statusCode: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        'Access-Control-Allow-Origin': '*'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return { statusCode: 500, body: 'ORM proxy error: ' + (e?.message || String(e)) };
  }
};