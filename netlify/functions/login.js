// netlify/functions/login.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { username, password } = JSON.parse(event.body || '{}');

  // Expected credentials: admin + env var password
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = process.env.RAILOPS_ADMIN_PASSWORD || '';

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return { statusCode: 401, body: JSON.stringify({ ok:false, msg:'Invalid credentials' }) };
  }

  // Create a signed session valid for 7 days
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = JSON.stringify({ sub: 'admin', exp });
  const secret = process.env.RAILOPS_SESSION_SECRET || '';

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  const token = `${btoa(payload)}.${sig}`;

  const cookie = [
    `railops_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`
  ].join('; ');

  return {
    statusCode: 200,
    headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok:true })
  };
};
