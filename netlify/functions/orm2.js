// netlify/functions/orm2.js
// Query-param proxy with retries across ORM subdomains.
// Usage: /api/orm2?path=standard/{z}/{x}/{y}.png

const HOSTS = [
  'a.tile.openrailwaymap.org',
  'b.tile.openrailwaymap.org',
  'c.tile.openrailwaymap.org',
  'tile.openrailwaymap.org' // last fallback
];

const UA = 'RailOps Netlify Proxy (+https://traintracker2-0.netlify.app)';

exports.handler = async (event) => {
  try {
    const path = (event.queryStringParameters && event.queryStringParameters.path) || '';

    // Validate incoming path strictly
    if (!/^(standard|maxspeed|signals)\/\d+\/\d+\/\d+\.png$/.test(path)) {
      return txt(400, `Bad or missing "path". Try ?path=standard/5/27/19.png (got "${path}")`);
    }

    // Try each host in order with a short timeout
    let lastErr = null;
    for (const host of HOSTS) {
      const url = `https://${host}/${path}`;
      try {
        const resp = await fetchWithTimeout(url, {
          headers: {
            'User-Agent': UA,
            'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
            'Cache-Control': 'no-cache'
          },
          redirect: 'follow'
        }, 7000); // 7s timeout per host

        if (!resp.ok) {
          // Non-200 response; try next host unless 404 (no tile)
          if (resp.status === 404) {
            const body = await resp.text().catch(()=>'');
            return txt(404, `Upstream 404 at ${url}\n${body.slice(0,300)}`);
          }
          lastErr = new Error(`Upstream ${host} returned ${resp.status}`);
          continue;
        }

        const ct = resp.headers.get('content-type') || 'image/png';
        const ab = await resp.arrayBuffer();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Access-Control-Allow-Origin': '*'
          },
          body: Buffer.from(ab).toString('base64'),
          isBase64Encoded: true
        };
      } catch (e) {
        lastErr = e;
        // try next host
      }
    }

    // If we got here, all hosts failed
    return txt(502, `All ORM hosts failed (${HOSTS.join(', ')}).\nLast error: ${String(lastErr && lastErr.message || lastErr)}`);

  } catch (e) {
    return txt(500, 'ORM2 proxy fatal error: ' + (e && e.message ? e.message : String(e)));
  }
};

// Helpers
function txt(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body
  };
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = 7000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}