// boot.js — external loader with loud diagnostics
(function () {
  const badgeEl = document.getElementById('badge');
  const setBadge = (t, cls) => { badgeEl.textContent = t; badgeEl.className = ''; if (cls) badgeEl.classList.add(cls); };

  function loadMain() {
    if (!window.ol || !window.ol.Map) {
      setBadge("OpenLayers not ready after /assets/ol/ol.js. Check that URL returns JS.", "bad");
      return;
    }
    setBadge("OpenLayers loaded ✔︎ — loading main.js…");
    const s = document.createElement('script');
    s.src = '/main.js?v=' + Date.now();
    s.defer = false; s.async = false;
    s.onload = () => setBadge("main.js loaded ✔︎ (initializing map)…");
    s.onerror = () => setBadge("Couldn't load /main.js — 404 or redirected to login.", "bad");
    document.body.appendChild(s);
  }

  // If OL already on page, run immediately. Otherwise poll a few times.
  if (window.ol && window.ol.Map) return loadMain();

  setBadge("Booting (waiting for /assets/ol/ol.js)…");
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (window.ol && window.ol.Map) { clearInterval(timer); loadMain(); }
    else if (tries === 10) { clearInterval(timer); setBadge("Still no OpenLayers — check /assets/ol/ol.js", "bad"); }
  }, 200);
})();