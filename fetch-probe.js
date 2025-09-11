(async function () {
  const out = document.getElementById('out');
  function log(...a){ out.textContent += '\n' + a.join(' '); }

  try {
    log('GET /api/cdn/ol.js …');
    const r = await fetch('/api/cdn/ol.js', { redirect: 'follow' });
    log('status:', r.status);
    log('content-type:', r.headers.get('content-type'));
    const text = await r.text();
    log('first 120 chars:\n', text.slice(0,120).replace(/\n/g,'\\n'));
    if (text.startsWith('<!DOCTYPE') || /login/i.test(text)) {
      log('Looks like HTML/login — redirect hijack is happening.');
    } else if (r.ok) {
      log('Looks like JS ✔︎ — function and redirects are working.');
    }
  } catch (e) {
    log('fetch error:', e && e.message ? e.message : String(e));
  }
})();