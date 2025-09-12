// netlify/functions/cdn.js
import { CSP } from './_csp.js';

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/cdn\//, ''); // strip /api/cdn/

    // Example: /api/cdn/ol.js → https://cdn.jsdelivr.net/npm/ol@latest/dist/ol.js
    let target;
    if (path === 'ol.js') {
      target = 'https://cdn.jsdelivr.net/npm/ol@latest/dist/ol.js';
    } else if (path === 'ol.css') {
      target = 'https://cdn.jsdelivr.net/npm/ol@latest/ol.css';
    } else {
      return new Response(`Unknown resource: ${path}`, { status: 404 });
    }

    // Fetch the resource from jsDelivr
    const res = await fetch(target);
    if (!res.ok) {
      return new Response(`Failed to fetch ${target}`, { status: res.status });
    }

    // Copy body and set headers
    const body = await res.text();
    const contentType = path.endsWith('.css')
      ? 'text/css; charset=UTF-8'
      : 'application/javascript; charset=UTF-8';

    return new Response(body, {
      headers: {
        'content-type': contentType,
        'content-security-policy': CSP,   // ✅ apply shared CSP
        'x-content-type-options': 'nosniff',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
};