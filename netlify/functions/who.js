// Returns request info AND (for ?probe=/path or full URL) the upstream status
// and key response headers including Content-Security-Policy.
exports.handler = async (event) => {
  try {
    const out = {
      now: new Date().toISOString(),
      method: event.httpMethod,
      path: event.path,
      rawUrl: event.rawUrl || null,
      headers: event.headers || {},
      query: event.queryStringParameters || {}
    };

    const target = out.query && out.query.probe ? out.query.probe : null;

    if (target) {
      // allow relative paths (e.g. /img-probe.html) or absolute URLs
      let url;
      try {
        const base = new URL(event.rawUrl || 'https://example.com/');
        url = new URL(target, base.origin).toString();
      } catch { url = target; }

      try {
        const r = await fetch(url, { redirect: 'manual' });
        const pick = (h) => {
          const wanted = [
            'content-security-policy',
            'content-type',
            'cache-control',
            'location',
            'x-nf-request-id',
            'x-content-type-options'
          ];
          const obj = {};
          for (const k of wanted) {
            const v = r.headers.get(k);
            if (v) obj[k] = v;
          }
          return obj;
        };

        out.probe = {
          url,
          ok: r.ok,
          status: r.status,
          headers: pick(r.headers)
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
    body: JSON.stringify(obj, null, 2)
  };
}