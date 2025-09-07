// Admin login with per-IP rate limiting and temporary lockout

const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCK_MINUTES = parseInt(process.env.LOCK_MINUTES || '15', 10);
const WINDOW_MIN   = parseInt(process.env.WINDOW_MIN || '10', 10);

// In-memory throttle (resets on cold start). Good enough for small sites.
const mem = { attempts: new Map() };

function now(){ return Date.now(); }
function ipOf(event){
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}
function prune(list, winMs){ const cut = now() - winMs; return list.filter(ts => ts >= cut); }
function cookieFor(token, maxAgeSec){
  return `railops_session=${encodeURIComponent(token)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const ADMIN_USER = 'admin';
  const ADMIN_PASS = process.env.RAILOPS_ADMIN_PASSWORD || '';
  const SECRET     = process.env.RAILOPS_SESSION_SECRET || '';
  if (!ADMIN_PASS || !SECRET) return { statusCode: 500, body: 'Server not configured' };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const { username, password } = body;

  const ip = ipOf(event);
  const state = mem.attempts.get(ip) || { tries: [], lockUntil: 0 };

  if (state.lockUntil && now() < state.lockUntil) {
    const secs = Math.ceil((state.lockUntil - now())/1000);
    return resp(401, { ok:false, msg:`Too many attempts. Try again in ${secs}s.` });
  }

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    const winMs = WINDOW_MIN * 60 * 1000;
    state.tries = prune(state.tries, winMs);
    state.tries.push(now());
    if (state.tries.length >= MAX_ATTEMPTS) { state.lockUntil = now() + LOCK_MINUTES * 60 * 1000; state.tries = []; }
    mem.attempts.set(ip, state);
    await new Promise(r => setTimeout(r, 100 + Math.random()*300)); // slow brute force
    return resp(401, { ok:false, msg:'Invalid credentials' });
  }

  // success -> clear
  mem.attempts.set(ip, { tries: [], lockUntil: 0 });

  // Signed session cookie (role: admin)
  const exp = Date.now() + 7*24*60*60*1000;
  const payload = JSON.stringify({ sub:'admin', role:'admin', exp });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  const token = `${btoa(payload)}.${sig}`;

  return {
    statusCode: 200,
    headers: { 'Set-Cookie': cookieFor(token, 7*24*60*60), 'Content-Type':'application/json' },
    body: JSON.stringify({ ok:true })
  };
};

function resp(code, obj){ return { statusCode: code, headers:{'Content-Type':'application/json'}, body: JSON.stringify(obj) }; }