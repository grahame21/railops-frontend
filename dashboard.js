/* global ol */
(function () {
  // --- Map base ---
  const map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attributions: '© OpenStreetMap'
        })
      })
    ],
    controls: ol.control.defaults().extend([new ol.control.ScaleLine()]),
    view: new ol.View({
      center: ol.proj.fromLonLat([133.7751, -25.2744]),
      zoom: 4.5,
      minZoom: 2,
      maxZoom: 19
    })
  });

  // Expose for future scripts (e.g., trains)
  window.map = map;

  // --- Helpers ---
  async function tryLoadGeoJSON(url) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      return new ol.format.GeoJSON().readFeatures(json, { featureProjection: 'EPSG:3857' });
    } catch (e) {
      console.warn('Optional file missing or invalid:', url);
      return [];
    }
  }

  // --- Railway lines layer ---
  const railStyle = (f) =>
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: f.get('class') === 'main' ? '#ffd54f' : '#81d4fa',
        width: f.get('class') === 'main' ? 3 : 2
      })
    });

  const railSource = new ol.source.Vector();
  const railLayer = new ol.layer.Vector({ source: railSource, style: railStyle, visible: true });

  tryLoadGeoJSON('data/railways.geojson').then((feats) => {
    if (feats.length) railSource.addFeatures(feats);
    else {
      // demo line so the toggle does something even without data
      const demo = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { class: 'main', name: 'Demo Rail Line' },
            geometry: { type: 'LineString', coordinates: [[113, -25], [133, -25], [153, -27]] }
          }
        ]
      };
      railSource.addFeatures(new ol.format.GeoJSON().readFeatures(demo, { featureProjection: 'EPSG:3857' }));
    }
  });

  // --- Coverage layers (semi-transparent fills) ---
  function makeCoverageLayer(color, file) {
    const src = new ol.source.Vector();
    tryLoadGeoJSON(file).then((feats) => src.addFeatures(feats));
    return new ol.layer.Vector({
      source: src,
      style: new ol.style.Style({ fill: new ol.style.Fill({ color }) }),
      visible: false
    });
  }

  const telstraLayer = makeCoverageLayer('rgba(0,176,255,0.35)', 'data/coverage/telstra_full.geojson');
  const mvnoLayer    = makeCoverageLayer('rgba(102,187,106,0.35)', 'data/coverage/telstra_mvno.geojson');
  const optVodLayer  = makeCoverageLayer('rgba(244,67,54,0.35)',  'data/coverage/optus_vodafone.geojson');

  map.addLayer(telstraLayer);
  map.addLayer(mvnoLayer);
  map.addLayer(optVodLayer);
  map.addLayer(railLayer);

  // --- Controls wiring ---
  const qs = (id) => document.getElementById(id);
  qs('toggle-rail')?.addEventListener('change', (e) => railLayer.setVisible(e.target.checked));
  qs('toggle-telstra')?.addEventListener('change', (e) => telstraLayer.setVisible(e.target.checked));
  qs('toggle-mvno')?.addEventListener('change', (e) => mvnoLayer.setVisible(e.target.checked));
  qs('toggle-optvod')?.addEventListener('change', (e) => optVodLayer.setVisible(e.target.checked));

  // 🇦🇺 Australia zoom
  qs('btn-au')?.addEventListener('click', () => {
    map.getView().animate({
      center: ol.proj.fromLonLat([133.7751, -25.2744]),
      zoom: 4.5,
      duration: 600
    });
  });

  // --- Geolocate (pulse marker overlay) ---
  const markerEl = document.createElement('div');
  markerEl.className = 'pulse';
  const marker = new ol.Overlay({ element: markerEl, positioning: 'center-center', stopEvent: false });
  map.addOverlay(marker);

  function goMyLocation() {
    if (!('geolocation' in navigator)) return alert('Geolocation not available.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const xy = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]);
        marker.setPosition(xy);
        map.getView().animate({ center: xy, zoom: Math.max(map.getView().getZoom(), 12), duration: 700 });
      },
      () => alert('Unable to get your location. Check permissions.'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
  qs('btn-locate')?.addEventListener('click', goMyLocation);

  // --- Popup (feature info for rail/coverage; trains later) ---
  const popupEl = document.getElementById('popup');
  const popupContent = document.getElementById('popup-content');
  const popupClose = document.getElementById('popup-close');
  const popup = new ol.Overlay({ element: popupEl, offset: [0, -12], positioning: 'bottom-center', stopEvent: true });
  map.addOverlay(popup);

  popupClose.addEventListener('click', () => (popupEl.style.display = 'none'));

  map.on('singleclick', (evt) => {
    const features = map.getFeaturesAtPixel(evt.pixel);
    if (!features || !features.length) {
      popupEl.style.display = 'none';
      return;
    }
    const f = features[0];
    const props = f.getProperties();
    const shown = Object.fromEntries(Object.entries(props).filter(([k]) => k !== 'geometry'));
    const rows = Object.keys(shown).length
      ? Object.entries(shown).map(([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`).join('')
      : `<tr><td colspan="2">No attributes</td></tr>`;

    popupContent.innerHTML = `
      <h3>${shown.name || shown.provider || shown.operator || 'Feature'}</h3>
      <table>${rows}</table>
    `;
    popup.setPosition(evt.coordinate);
    popupEl.style.display = 'block';
  });

  // --- Hook for future trains layer ---
  // const trainsLayer = new ol.layer.Vector({ source: new ol.source.Vector(), style: yourTrainStyle });
  // map.addLayer(trainsLayer);
  // trainsLayer.getSource().addFeatures(...);
})();