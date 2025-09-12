(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const say = (msg, tone) => {
    status.textContent = msg;
    status.className = 'badge' + (tone ? ' ' + tone : '');
    console.log('[dash]', msg);
  };

  // Ensure OpenLayers is loaded
  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers not loaded (CSP or CDN blocked).', 'warn');
    return;
  }

  // Base OSM layer
  const osm = new ol.layer.Tile({
    source: new ol.source.OSM({ crossOrigin: 'anonymous' })
  });

  // Rails (OpenRailwayMap) overlay
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.95,
    source: new ol.source.XYZ({
      url: 'https://{a-c}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap contributors'
    })
  });

  // Map (north-up: rotation disabled)
  const view = new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Australia
    zoom: 4.8
  });

  const interactions = ol.interaction.defaults({
    altShiftDragRotate: false,
    pinchRotate: false
  });

  const map = new ol.Map({
    target: 'map',
    view,
    interactions,
    layers: [osm, rails]
  });

  // UI: toggle rails, recenter AU
  $('tog-rails').onchange = (e) => rails.setVisible(e.target.checked);
  $('btn-au').onclick = () =>
    view.animate({
      center: ol.proj.fromLonLat([133.7751, -25.2744]),
      zoom: 4.8,
      duration: 400
    });

  // Tile error hints (CSP)
  osm.getSource().on('tileloaderror', () =>
    say('⚠️ OSM tile blocked — add *.tile.openstreetmap.org to img-src.', 'warn')
  );
  rails.getSource().on('tileloaderror', () =>
    say('⚠️ ORM tile blocked — add *.tile.openrailwaymap.org to img-src.', 'warn')
  );

  // Zoom/DPR indicator
  const zi = $('zoomInfo');
  const refresh = () => {
    const z = view.getZoom();
    const dpr = Math.round(window.devicePixelRatio || 1);
    zi.textContent = `z=${z?.toFixed?.(2) ?? z ?? '–'} · DPR=${dpr}`;
  };
  view.on('change:resolution', refresh);
  refresh();

  map.once('rendercomplete', () => say('✅ OpenLayers + base map rendered', 'ok'));
})();