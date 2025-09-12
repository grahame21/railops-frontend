(function () {
  const $ = id => document.getElementById(id);
  const status = $('status') || { textContent: '' };
  const say = (m) => { status.textContent = m; console.log(m); };

  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers failed to load (CSP/CDN)');
    return;
  }

  // OSM via Netlify proxy
  const osm = new ol.layer.Tile({
    source: new ol.source.OSM({
      url: '/tiles/osm/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous'
    })
  });

  // OpenRailwayMap via Netlify proxy
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.9,
    source: new ol.source.XYZ({
      url: '/tiles/orm/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap'
    })
  });

  const view = new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]),
    zoom: 4.8
  });

  const map = new ol.Map({
    target: 'map',
    layers: [osm, rails],
    view: view
  });

  map.once('rendercomplete', () => say('✅ Map rendered'));
})();