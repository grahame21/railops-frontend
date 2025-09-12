// main.js — RailOps dashboard boot

(function () {
  const $ = (id) => document.getElementById(id);
  const statusEl = $('status');
  const say = (msg) => {
    if (statusEl) statusEl.textContent = msg;
    console.log('[dashboard]', msg);
  };

  // 0) Hard guard: OL must be present (CSP/CDN issues otherwise)
  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers failed to load (CSP or CDN blocked).');
    return;
  }

  // 1) Sanity: map element must have height
  const mapDiv = $('map');
  if (!mapDiv) {
    console.error('Missing #map element.');
    return;
  }
  const rect = mapDiv.getBoundingClientRect();
  if (rect.height < 40) {
    say('❌ Map container has no height — check CSS (#map {height:100vh}).');
    return;
  }

  // 2) Base OSM layer
  const osm = new ol.layer.Tile({
    source: new ol.source.OSM({ crossOrigin: 'anonymous' })
  });
  osm.getSource().on('tileloaderror', () => {
    say('⚠️ OSM tile error — ensure CSP img-src allows *.tile.openstreetmap.org');
  });

  // 3) OpenRailwayMap rails overlay (XYZ)
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.9,
    source: new ol.source.XYZ({
      url: 'https://{a-c}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap contributors'
    })
  });
  rails.getSource().on('tileloaderror', () => {
    say('⚠️ ORM tile error — ensure CSP img-src allows *.tile.openrailwaymap.org');
  });

  // 4) Optional carrier overlays from local GeoJSON (graceful if missing)
  const mkCarrier = (url, rgba) =>
    new ol.layer.Vector({
      visible: true,
      opacity: 0.35,
      source: new ol.source.Vector({
        url,
        format: new ol.format.GeoJSON()
      }),
      style: new ol.style.Style({
        fill:   new ol.style.Fill({ color: rgba }),
        stroke: new ol.style.Stroke({ color: rgba, width: 1 })
      })
    });

  const telstra      = mkCarrier('/assets/coverage/telstra.geojson',       'rgba(77,163,255,0.35)');
  const telstraMVNO  = mkCarrier('/assets/coverage/telstra-mvno.geojson',  'rgba(77,255,219,0.35)');
  const optus        = mkCarrier('/assets/coverage/optus.geojson',         'rgba(255,206,77,0.35)');
  const vodaTPG      = mkCarrier('/assets/coverage/vodafone-tpg.geojson',  'rgba(255,102,102,0.35)');

  // 5) Disable rotation -> keep map north-up
  const interactions = ol.interaction.defaults({
    altShiftDragRotate: false,
    pinchRotate: false
  });

  // 6) Map + View
  const AU_CENTER = ol.proj.fromLonLat([133.7751, -25.2744]);
  const view = new ol.View({ center: AU_CENTER, zoom: 4.8 });

  const map = new ol.Map({
    target: 'map',
    layers: [osm, telstra, telstraMVNO, optus, vodaTPG, rails],
    view,
    interactions
  });

  // 7) UI wiring (toggles)
  const on = (id, handler) => {
    const el = $(id);
    if (el) el.addEventListener('change', handler);
  };

  on('tog-rails',        (e) => rails.setVisible(e.target.checked));
  on('tog-telstra',      (e) => telstra.setVisible(e.target.checked));
  on('tog-telstra-mvno', (e) => telstraMVNO.setVisible(e.target.checked));
  on('tog-optus',        (e) => optus.setVisible(e.target.checked));
  on('tog-voda',         (e) => vodaTPG.setVisible(e.target.checked));

  const btnAU = $('btn-au');
  if (btnAU) {
    btnAU.addEventListener('click', () =>
      view.animate({ center: AU_CENTER, zoom: 4.8, duration: 450 })
    );
  }

  // 8) My location pin
  const locLayer = new ol.layer.Vector({ source: new ol.source.Vector() });
  map.addLayer(locLayer);

  const dropPin = (lon, lat) => {
    const src = locLayer.getSource();
    src.clear();
    const feat = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([lon, lat])));
    feat.setStyle(
      new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 1],
          src:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48"><path fill="#ff4d4d" d="M24 45s-14-14.2-14-24A14 14 0 1 1 38 21c0 9.8-14 24-14 24z"/><circle cx="24" cy="21" r="5.5" fill="#fff"/></svg>'
            )
        })
      })
    );
    src.addFeature(feat);
  };

  const btnLocate = $('btn-locate');
  if (btnLocate) {
    btnLocate.addEventListener('click', () => {
      if (!navigator.geolocation) {
        say('Geolocation not supported');
        return;
      }
      say('Locating…');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const { longitude: lon, latitude: lat } = p.coords;
          dropPin(lon, lat);
          view.animate({
            center: ol.proj.fromLonLat([lon, lat]),
            zoom: Math.max(view.getZoom() || 4, 10),
            duration: 450
          });
          say('Location updated');
        },
        (err) => say('Location denied/unavailable: ' + (err && err.message ? err.message : err)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // 9) Zoom/DPR indicator
  const zoomInfo = $('zoomInfo');
  const refreshInfo = () => {
    if (!zoomInfo) return;
    const z = view.getZoom();
    const dpr = Math.round(window.devicePixelRatio || 1);
    zoomInfo.textContent = `z=${typeof z === 'number' ? z.toFixed(2) : '–'} · DPR=${dpr}`;
  };
  view.on('change:resolution', refreshInfo);
  refreshInfo();

  // 10) Logout clears cookie and returns to login
  const btnLogout = $('logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      try {
        document.cookie = 'railops_session=; Max-Age=0; path=/; SameSite=Lax';
      } catch (e) {}
      window.location.href = '/login.html';
    });
  }

  // 11) First paint feedback
  map.once('rendercomplete', () => say('✅ Canvas rendered'));
  say('Booting…');
})();