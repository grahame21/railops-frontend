// Edge guard: public login + APIs; protects /dashboard.html (admin or guest) and /admin/* (admin only)

export default async (request, context) => {
  const url = new URL(request.url);
  const path = url.pathname;

  // Public paths (no cookie required)
  if (
    path === '/login.html' ||
    path === '/' ||
    path.startsWith('/api/login') ||
    path.startsWith('/api/logout') ||
    path.startsWith('/api/guests') // unified guest endpoint
  ) {
    return;
  }

  // Require session cookie
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/railops_session=([^;]+)/);
  if (!m) return Response.redirect(new URL('/login.html', url), 302);

  const token = decodeURIComponent(m[1]);
  const [b64Payload, b64Sig] = token.split('.');
  if (!b64Payload || !b64Sig) return Response.redirect(new URL('/login.html', url), 302);

  const payload = atob(b64Payload);
  const secret = Deno.env.get('RAILOPS_SESSION_SECRET') || '';
  const encoder = new TextEncoder();
  const expectedSigBytes = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    encoder.encode(payload)
  );
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBytes)));
  if (expectedSig !== b64Sig) return Response.redirect(new URL('/login.html', url), 302);

  let obj;
  try { obj = JSON.parse(payload); } catch { return Response.redirect(new URL('/login.html', url), 302); }
  if (!obj || !obj.exp || Date.now() > obj.exp) return Response.redirect(new URL('/login.html', url), 302);

  const role = obj.role || 'guest';

  // Admin-only area
  if (path.startsWith('/admin/')) {
    if (role !== 'admin') return Response.redirect(new URL('/login.html', url), 302);
  }

  // Dashboard allowed for admin or guest
  if (path === '/dashboard.html') {
    if (role !== 'admin' && role !== 'guest') return Response.redirect(new URL('/login.html', url), 302);
  }

  return;
};