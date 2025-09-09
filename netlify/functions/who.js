// Returns what Netlify actually received + key headers.
// Use: /api/who            → info about this request
// Use: /api/who?probe=/api/cdn/ol.js  → asks the server to GET that URL and report status/headers
exports.handler = async (event) => {
  try {
    const out = {
      now: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      rawUrl: event.rawUrl || null,
      headers: event.headers || {},
      query: event.queryStringParameters || {},
    };

    // Optional probe: server-side fetch to a path on your site
    const target = (event.queryStringParameters && event.queryStringParameters.probe) || null;
    if (target) {
      const base = new URL(event.rawUrl || 'https://example.com/');
      const url = new URL(target, base.origin).toString();
      try {
        const r = await fetch(url, { redirect: 'manual' });
        out.probe = {
          url,
          ok: r.ok,
          status: r.status,
          location: r.headers.get('location'),
          contentType: r.headers.get('content-type'),
        };
      } catch (e) {
        out.probe = { url, error: (e && e.message) || String(e) };
      }
    }

    return json(200, out);
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
};

function json(status, obj) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(obj, null, 2),
  };
}