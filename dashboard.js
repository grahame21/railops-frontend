(function () {
  const $ = id => document.getElementById(id);
  const status = $('status');
  const say = (m,tone) => { status.textContent = m; status.className = 'badge' + (tone?(' '+tone):''); console.log('[dashboard]', m); };

  if (!window.ol || !ol.Map) { say('❌ OpenLayers failed to load (CSP/CDN).', 'warn'); return; }

  const mapDiv = $('map');
  const rect = mapDiv.getBoundingClientRect();
  if (rect.height < 50) { say('❌ Map container has no height — CSS issue', 'warn'); return; }

  // OSM (proxied)
  const osm = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: '/tiles/osm/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous'
    })
  });
  osm.getSource().on('tileloaderror', () => {
    say('⚠️ OSM tile failed', 'warn');
  });

  // ORM (proxied)
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.9,
    source: new ol.source.XYZ({
      url: '/tiles/orm/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap'
    })
  });
  rails.getSource().on('tileloaderror', () => {
    say('⚠️ ORM tile failed', 'warn');
  });

  const interactions = ol.interaction.defaults({ altShiftDragRotate:false, pinchRotate:false });
  const view = new ol.View({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8 });
  const map = new ol.Map({
    target: 'map',
    view, interactions,
    layers: [osm, rails]
  });

  $('tog-rails').onchange = e => rails.setVisible(e.target.checked);
  $('btn-au').onclick = () =>
    view.animate({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8, duration: 450 });

  map.once('rendercomplete', () => say('✅ Canvas rendered'));
})();