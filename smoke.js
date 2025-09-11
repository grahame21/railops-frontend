(function () {
  const out = document.getElementById('out');
  const say = (m) => { if (out) out.textContent = m; console.log('[smoke]', m); };

  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers NOT loaded (CSP/redirects). View Source of this page and confirm the <script src> points to cdn.jsdelivr.net and _headers allows it.');
    return;
  }

  say('✅ OpenLayers loaded — drawing map…');
  try {
    new ol.Map({
      target: 'map',
      layers: [ new ol.layer.Tile({ source: new ol.source.OSM({ crossOrigin: "anonymous" }) }) ],
      view: new ol.View({ center: ol.proj.fromLonLat([133.7751, -25.2744]), zoom: 4 })
    });
  } catch (e) {
    say('❌ Error creating map: ' + (e?.message || String(e)));
    console.error(e);
  }
})();