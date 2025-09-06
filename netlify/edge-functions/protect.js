// netlify/edge-functions/protect.js
export default async (request, context) => {
  const url = new URL(request.url);

  // Let the login & API endpoints pass through
  if (url.pathname.startsWith('/api/')) return;

  // Read session cookie
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/railops_session=([^;]+)/);
  if (!match) {
    return Response.redirect(new URL('/login.html', url), 302);
  }

  // Validate the signed session (very lightweight)
  const token = decodeURIComponent(match[1] || '');
  // token format: base64(payload).base64(sig)
  const [b64Payload, b64Sig] = token.split('.');
  if (!b64Payload || !b64Sig) {
    return Response.redirect(new URL('/login.html', url), 302);
  }

  const secret = Deno.env.get('RAILOPS_SESSION_SECRET') || '';
  const encoder = new TextEncoder();
  const payload = atob(b64Payload);
  const expectedSigBytes = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(payload)
  );
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBytes)));

  if (expectedSig !== b64Sig) {
    return Response.redirect(new URL('/login.html', url), 302);
  }

  // Optional: expire check
  try {
    const obj = JSON.parse(payload);
    if (!obj || !obj.exp || Date.now() > obj.exp) {
      return Response.redirect(new URL('/login.html', url), 302);
    }
  } catch { return Response.redirect(new URL('/login.html', url), 302); }

  // All good → continue to the requested page
  return;
};
