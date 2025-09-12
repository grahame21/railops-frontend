// netlify/functions/who.js
import { CSP } from './_csp.js';

export default async (req, context) => {
  const payload = {
    now: new Date().toISOString(),
    method: req.method,
    path: req.url,
    headers: Object.fromEntries(req.headers),
    query: Object.fromEntries(new URL(req.url).searchParams),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'content-security-policy': CSP,   // ✅ unified CSP
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    },
  });
};