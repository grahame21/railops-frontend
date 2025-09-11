(function () {
  const out = document.getElementById('out');
  const say = (m) => { out.textContent = m; console.log('[smoke]', m); };

  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers NOT loaded (CSP/redirects).');
    return;
  }
  say('✅ OpenLayers loaded — drawing map…');
  new ol.Map({
    target: 'map',
    layers: [ new ol.layer.Tile({ source: new ol.source.OSM({ crossOrigin: "anonymous" }) }) ],
    view: new ol.View({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4 })
  });
})();