(function () {
  const out = document.getElementById('out');

  function say(msg) {
    if (out) out.textContent = msg;
    console.log('[smoke]', msg);
  }

  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers NOT loaded (check CSP script-src or CDN reachability)');
    return;
  }

  say('✅ OpenLayers loaded from CDN — drawing map…');

  try {
    const map = new ol.Map({
      target: 'map',
      layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }) ],
      view: new ol.View({
        center: ol.proj.fromLonLat([133.7751, -25.2744]),
        zoom: 4
      })
    });
  } catch (e) {
    say('❌ Error creating map: ' + (e && e.message ? e.message : String(e)));
    console.error(e);
  }
})();