// netlify/functions/guests.js
// In-memory guest accounts + login in ONE function so state is shared here.
// Actions: create, list, revoke (admin only); login (guest).
//
// WARNING: In-memory -> resets on cold start/redeploy. Use Netlify Blobs for persistence later.

const store = new Map(); // username -> { username, password, expires, disabled }

// ---------- Helpers ----------
function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
function ok(body) { return json(200, body); }
function bad(msg, code = 400) { return json(code, { ok: false, msg }); }

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = ''; for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function isAdmin(event) {
  try {
    const cookie = event.headers.cookie || '';
    const m = cookie.match(/railops_session=([^;]+)/);
    if (!m) return false;
    const token = decodeURIComponent(m[1]);
    const [b64Payload, b64Sig] = token.split('.');
    if (!b64Payload || !b64Sig) return false;

    const payload = atob(b64Payload);
    const secret = process.env.RAILOPS_SESSION_SECRET || '';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
    if (expectedSig !== b64Sig) return false;

    const obj = JSON.parse(payload);
    if (!obj || !obj.exp || Date.now() > obj.exp) return false;
    return obj.role === 'admin';
  } catch {
    return false;
  }
}

async function signGuestCookie(username, expMs) {
  const exp = expMs || (Date.now() + 7 * 24 * 60 * 60 * 1000);
  const payload = JSON.stringify({ sub: username, role: 'guest', exp });
  const secret = process.env.RAILOPS_SESSION_SECRET || '';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  const token = `${btoa(payload)}.${sig}`;
  const maxAge = Math.max(1, Math.floor((exp - Date.now()) / 1000));
  const cookie = [
    `railops_session=${encodeURIComponent(token)}`,
    'HttpOnly', 'Secure', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAge}`
  ].join('; ');
  return cookie;
}

// ---------- Handler ----------
exports.handler = async (event) => {
  const method = event.httpMethod;
  const input = method === 'GET' ? {} : (JSON.parse(event.body || '{}'));
  const action = (input.action || (new URL(event.rawUrl).searchParams.get('action')) || '').toLowerCase();

  // Guest LOGIN (public)
  if (action === 'login' && method === 'POST') {
    const { username, password } = input;
    if (!username || !password) return bad('Missing fields');
    const uname = String(username).toLowerCase();
    const g = store.get(uname);
    if (!g) return bad('Invalid credentials', 401);
    if (g.disabled) return bad('Guest revoked', 401);
    if (g.expires && Date.now() > g.expires) return bad('Guest expired', 401);
    if (password !== g.password) return bad('Invalid credentials', 401);

    const cookie = await signGuestCookie(uname, g.expires || undefined);
    return {
      statusCode: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  }

  // ADMIN-ONLY actions below
  const admin = await isAdmin(event);
  if (!admin) return bad('Unauthorized', 401);

  if (action === 'create' && method === 'POST') {
    const { username, expiresDays = 7 } = input;
    if (!username) return bad('Missing username');
    const uname = String(username).toLowerCase();
    const password = genPassword();
    const expires = Date.now() + Math.max(1, parseInt(expiresDays, 10)) * 24 * 60 * 60 * 1000;
    const record = { username: uname, password, expires, disabled: false };
    store.set(uname, record);
    return ok({ ok: true, username: uname, password, expires });
  }

  if (action === 'list' && method === 'GET') {
    const list = Array.from(store.values());
    return ok({ ok: true, guests: list });
  }

  if (action === 'revoke' && method === 'POST') {
    const { username } = input;
    if (!username) return bad('Missing username');
    const uname = String(username).toLowerCase();
    const g = store.get(uname);
    if (!g) return bad('Not found', 404);
    g.disabled = true;
    store.set(uname, g);
    return ok({ ok: true });
  }

  return bad('Unknown action or method', 400);
};