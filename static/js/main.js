// static/js/main.js
(function () {
  const statusEl = document.getElementById('status');

  // --- Helpers ---------------------------------------------------------------
  const qs = new URL(location.href).searchParams;
  function setStatus(msg) { statusEl && (statusEl.textContent = msg); }
  function getKey() {
    // Priority: URL ?key=  → window.MAPTILER_KEY in index.html → localStorage
    const fromUrl = qs.get('key');
    if (fromUrl) {
      try { localStorage.setItem('MAPTILER_KEY', fromUrl); } catch (e) {}
      return fromUrl;
    }
    if (window.MAPTILER_KEY && window.MAPTILER_KEY !== 'PASTE_YOUR_KEY_HERE') return window.MAPTILER_KEY;
    try {
      const ls = localStorage.getItem('MAPTILER_KEY');
      if (ls) return ls;
    } catch (e) {}
    return null;
  }

  // --- Offline base layer ----------------------------------------------------
  const offlineSource = new ol.source.DataTile({
    loader: function () {
      const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d');
      g.fillStyle = '#202020'; g.fillRect(0, 0, size, size);
      g.strokeStyle = 'rgba(255,255,255,.1)';
      for (let i = 0; i <= size; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke(); }
      g.fillStyle = '#fff'; g.font = '12px system-ui'; g.fillText('OFFLINE BASE', 12, 22);
      return createImageBitmap(c);
    }, transition: 0
  });
  const layerOffline = new ol.layer.WebGLTile({ source: offlineSource });

  // --- Map shell -------------------------------------------------------------
  const map = new ol.Map({
    target: 'map',
    layers: [layerOffline], // base layer index 0
    view: new ol.View({ center: ol.proj.fromLonLat([135.5, -30]), zoom: 5, rotation: 0, constrainRotation: 0 })
  });

  // --- Placeholder Rail + Stations (visible when selected) -------------------
  const railLines = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [
        new ol.Feature(new ol.geom.LineString([
          ol.proj.fromLonLat([129, -31]),
          ol.proj.fromLonLat([134, -31]),
          ol.proj.fromLonLat([138.6, -34.9])
        ])),
        new ol.Feature(new ol.geom.LineString([
          ol.proj.fromLonLat([151.2, -33.9]),
          ol.proj.fromLonLat([150.9, -34.4]),
          ol.proj.fromLonLat([149.1, -35.3])
        ]))
      ]
    }),
    style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#25a05a', width: 3 }) })
  });
  const stations = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [
        new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([138.601, -34.928]))), // Adelaide
        new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([151.206, -33.868]))), // Sydney
        new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([144.963, -37.814])))  // Melbourne
      ]
    }),
    style: new ol.style.Style({
      image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#e33' }), stroke: new ol.style.Stroke({ color: '#fff', width: 1 }) })
    })
  });
  map.addLayer(railLines);
  map.addLayer(stations);

  // --- Coverage placeholder layer -------------------------------------------
  const covLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: [new ol.Feature(new ol.geom.Polygon([[
        ol.proj.fromLonLat([137, -35]), ol.proj.fromLonLat([139, -35]),
        ol.proj.fromLonLat([139, -34]), ol.proj.fromLonLat([137, -34]),
        ol.proj.fromLonLat([137, -35])
      ]]))]
    }),
    visible: false,
    style: new ol.style.Style({
      fill: new ol.style.Fill({ color: 'rgba(0,123,255,0.20)' }),
      stroke: new ol.style.Stroke({ color: 'rgba(0,123,255,0.8)', width: 1 })
    })
  });
  map.addLayer(covLayer);

  // --- Zoom presets ----------------------------------------------------------
  const boundsByKey = {
    'AUS': [112.0, -44.0, 154.0, -10.0],
    'NSW': [140.9, -37.5, 153.7, -28.0],
    'VIC': [140.9, -39.2, 150.1, -33.8],
    'SA':  [129.0, -38.2, 141.0, -25.0],
    'WA':  [112.8, -35.3, 129.0, -13.6],
    'NT':  [129.0, -26.0, 138.0, -10.7],
    'QLD': [138.0, -29.2, 154.1, -9.9],
    'TAS': [144.0, -44.0, 149.0, -39.0],
    'ACT': [148.7, -35.9, 149.5, -35.1]
  };
  function fitKey(k) {
    if (k === 'here' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const ll = [pos.coords.longitude, pos.coords.latitude];
        map.getView().animate({ center: ol.proj.fromLonLat(ll), zoom: 10, duration: 500 });
      }, () => setStatus('Location denied.'));
      return;
    }
    const b = boundsByKey[k] || boundsByKey['AUS'];
    const ext = ol.proj.transformExtent(b, 'EPSG:4326', 'EPSG:3857');
    map.getView().fit(ext, { duration: 400, padding: [20, 20, 20, 20] });
  }
  fitKey('AUS');

  // --- Base providers + automatic fallback ----------------------------------
  function makeXYZ(url, attr) {
    return new ol.source.XYZ({ url, attributions: attr, crossOrigin: 'anonymous', maxZoom: 19 });
  }

  function setBase(sourceName, src) {
    const layer = new ol.layer.Tile({ source: src });
    map.getLayers().setAt(0, layer);
    let first = true, errs = 0;
    src.on('tileloadend', () => { if (first) { first = false; setStatus(sourceName + ' tiles OK.'); } });
    src.on('tileloaderror', () => { errs++; setStatus(sourceName + ' tile error (' + errs + ')'); });
    // 6s watchdog for initial tile
    setTimeout(() => { if (first) setStatus('Timeout waiting for ' + sourceName); }, 6000);
  }

  function setOffline() {
    map.getLayers().setAt(0, layerOffline);
    setStatus('Offline base.');
  }

  function useMapTiler() {
    const key = getKey();
    if (!key) {
      setStatus('MapTiler key missing. Add ?key=YOUR_KEY or set window.MAPTILER_KEY.');
      setOffline();
      return;
    }
    const src = makeXYZ(
      'https://api.maptiler.com/maps/streets/256/{z}/{x}/{y}.png?key=' + encodeURIComponent(key),
      '© OpenStreetMap, © MapTiler'
    );
    setBase('MapTiler', src);
  }

  function useOSM() {
    const src = makeXYZ('https://tile.openstreetmap.org/{z}/{x}/{y}.png', '© OpenStreetMap');
    setBase('OSM', src);
  }

  function useEsri() {
    const src = makeXYZ(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      'Source: Esri'
    );
    setBase('Esri Streets', src);
  }

  // Try MapTiler → OSM → Esri, then offline
  function setBestAvailable() {
    let tried = 0;
    const steps = [useMapTiler, useOSM, useEsri, setOffline];
    function next() {
      const fn = steps[tried++] || setOffline;
      fn();
      // if we timed out or errored too much, try the next provider
      const start = Date.now();
      const check = setInterval(() => {
        const txt = statusEl.textContent || '';
        const tooLong = Date.now() - start > 6500 && /Timeout/.test(txt);
        const hardErr = /(tile error|blocked|unreachable|No tile source|No basemap provider)/i.test(txt);
        if (tooLong || hardErr) { clearInterval(check); if (tried < steps.length) next(); }
        // if we got "tiles OK", stop checking
        if (/tiles OK/.test(txt)) clearInterval(check);
      }, 800);
    }
    next();
  }

  // --- UI wiring -------------------------------------------------------------
  const styleSel = document.getElementById('styleSel');
  const zoomSel  = document.getElementById('zoomSel');
  const railSel  = document.getElementById('railSel');
  const covAllSel = document.getElementById('covAllSel');
  const covOneSel = document.getElementById('covOneSel');
  const resetBtn = document.getElementById('resetBtn');

  if (styleSel) styleSel.addEventListener('change', e => {
    const v = e.target.value;
    if (v === 'offline') setOffline();
    else setBestAvailable(); // choose best online provider
  });

  if (zoomSel) zoomSel.addEventListener('change', e => fitKey(e.target.value));

  if (railSel) railSel.addEventListener('change', e => {
    const v = e.target.value;
    railLines.setVisible(v !== 'none');
    stations.setVisible(v !== 'none' && v !== 'linesOnly');
  });

  if (covAllSel) covAllSel.addEventListener('change', e => {
    const v = e.target.value;
    covLayer.setVisible(v !== 'none');
    setStatus('Coverage (All ops): ' + v + ' (placeholder)');
  });

  if (covOneSel) covOneSel.addEventListener('change', e => {
    setStatus('Coverage (Single op): ' + e.target.value + ' (placeholder)');
  });

  if (resetBtn) resetBtn.addEventListener('click', () => {
    map.getView().animate({ rotation: 0 });
    fitKey('AUS');
  });

  // --- Boot ------------------------------------------------------------------
  setBestAvailable(); // default: try MapTiler, fall back as needed
})();