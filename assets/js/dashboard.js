(function () {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const say = (msg, tone) => {
    statusEl.textContent = msg;
    statusEl.className = 'badge' + (tone ? ' ' + tone : '');
    console.log('[dash]', msg);
  };

  // Ensure OpenLayers is present (loaded by <script src="/api/cdn/ol.js"> in dashboard.html)
  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers not loaded (CSP or proxy).', 'warn');
    return;
  }

  // Base OSM
  const osm = new ol.layer.Tile({
    source: new ol.source.OSM({ crossOrigin: 'anonymous' })
  });

  // OpenRailwayMap overlay
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.95,
    source: new ol.source.XYZ({
      url: 'https://{a-c}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap contributors'
    })
  });

  // Map (north-up)
  const view = new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // AU
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

  // UI wiring
  const railsToggle = $('tog-rails');
  if (railsToggle) railsToggle.onchange = (e) => rails.setVisible(e.target.checked);

  const recenterBtn = $('btn-au');
  if (recenterBtn) recenterBtn.onclick = () =>
    view.animate({ center: ol.proj.fromLonLat([133.7751, -25.2744]), zoom: 4.8, duration: 400 });

  // Helpful diagnostics
  osm.getSource().on('tileloaderror', () =>
    say('⚠️ OSM tile blocked — allow *.tile.openstreetmap.org (img-src/connect-src).', 'warn')
  );
  rails.getSource().on('tileloaderror', () =>
    say('⚠️ ORM tile blocked — allow *.tile.openrailwaymap.org (img-src/connect-src).', 'warn')
  );

  const zi = $('zoomInfo');
  const refresh = () => {
    const z = view.getZoom();
    const dpr = Math.round(window.devicePixelRatio || 1);
    if (zi) zi.textContent = `z=${z?.toFixed?.(2) ?? z ?? '–'} · DPR=${dpr}`;
  };
  view.on('change:resolution', refresh);
  refresh();

  map.once('rendercomplete', () => say('✅ OpenLayers + base map rendered', 'ok'));
})();