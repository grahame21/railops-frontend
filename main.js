/* ===============================
   RailOps Dashboard — main.js
   =============================== */

// ---------- Utilities / HUD ----------
const badge = (() => {
  const el = document.getElementById('badge');
  return (txt, cls) => {
    el.textContent = txt;
    el.className = '';
    if (cls) el.classList.add(cls);
    console.log('[badge]', txt);
  };
})();

// Show any uncaught JS errors in a visible box
window.addEventListener('error', (e) => {
  const box = document.getElementById('err');
  box.style.display = 'block';
  box.textContent =
    'JavaScript error: ' + (e?.error?.stack || e.message || String(e));
  console.error(e?.error || e);
});

// ---------- Logout ----------
document.getElementById('logout').onclick = () => {
  localStorage.removeItem('railops_session');
  location.href = '/login.html';
};

// ---------- Verify OpenLayers ----------
if (!window.ol || !ol.Map) {
  badge(
    'OpenLayers failed to load. Make sure /assets/ol/ol.js is present and loaded before main.js.',
    'bad'
  );
  throw new Error('OpenLayers not available');
}

// ---------- Base map ----------
const base = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    crossOrigin: 'anonymous',
  }),
  zIndex: 0,
});

const view = new ol.View({
  center: ol.proj.fromLonLat([133.7751, -25.2744]), // AU center
  zoom: 4.8,
  constrainRotation: 0, // lock north-up
});

const map = new ol.Map({ target: 'map', layers: [base], view });

// HUD info
const updHUD = () => {
  document.getElementById('z').textContent = view.getZoom().toFixed(2);
  document.getElementById('dpr').textContent = window.devicePixelRatio;
};
view.on('change:resolution', updHUD);
updHUD();

map.once('rendercomplete', () => badge('Canvas rendered ✔︎', 'ok'));
base.getSource().on('tileloadstart', () => badge('Base loading…'));
base.getSource().on('tileloadend', () => badge('Base tiles loaded ✔︎', 'ok'));
base.getSource().on('tileloaderror', () =>
  badge(
    'Base tile FAILED — check CSP img-src for tile.openstreetmap.org or content blocker.',
    'bad'
  )
);

// ---------- Rails (OpenRailwayMap) via YOUR proxy ----------
// You must have _redirects entries that map /api/orm/* → a.tile.openrailwaymap.org
const railsLayer = new ol.layer.Tile({
  title: 'Rails (ORM)',
  visible: true,
  zIndex: 10,
  source: new ol.source.XYZ({
    url: '/api/orm/standard/{z}/{x}/{y}.png',
    attributions:
      '© <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> contributors',
    maxZoom: 19,
    crossOrigin: 'anonymous',
  }),
});
map.addLayer(railsLayer);

// Toggle checkbox
document.getElementById('railsToggle').onchange = (e) => {
  railsLayer.setVisible(e.target.checked);
};

// ---------- Placeholder mobile coverage layers ----------
// These are simple rectangles as placeholders. Replace with real data later.
const to3857 = (ext) => ol.proj.transformExtent(ext, 'EPSG:4326', 'EPSG:3857');
const poly = (ext) => new ol.Feature(ol.geom.Polygon.fromExtent(to3857(ext)));
const rgba = (hex, a) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16),
    g = parseInt(c.slice(2, 4), 16),
    b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const carrier = (boxes, stroke, fillA, z) =>
  new ol.layer.Vector({
    source: new ol.source.Vector({ features: boxes.map(poly) }),
    style: new ol.style.Style({
      stroke: new ol.style.Stroke({ color: stroke, width: 1.6 }),
      fill: new ol.style.Fill({ color: rgba(stroke, fillA) }),
    }),
    zIndex: z,
  });

// Sample extents (VIC/NSW/SA areas) — swap with real coverage later
const telstraLayer = carrier(
  [
    [144.5, -38.5, 145.5, -37.5],
    [150.5, -34.2, 151.5, -33.5],
    [138.3, -35.2, 138.9, -34.7],
  ],
  '#3aa0ff',
  0.22,
  6
);
const mvnoLayer = carrier(
  [
    [144.6, -38.4, 145.4, -37.6],
    [150.6, -34.15, 151.45, -33.6],
  ],
  '#9aa3ad',
  0.2,
  5
);
const optusLayer = carrier(
  [
    [144.7, -38.45, 145.6, -37.55],
    [150.4, -34.25, 151.6, -33.45],
  ],
  '#ffd33d',
  0.22,
  7
);
const vodaLayer = carrier(
  [
    [144.8, -38.42, 145.55, -37.58],
    [150.55, -34.2, 151.55, -33.55],
  ],
  '#ff7b72',
  0.2,
  8
);

map.addLayer(telstraLayer);
map.addLayer(mvnoLayer);
map.addLayer(optusLayer);
map.addLayer(vodaLayer);

// Toggle checkboxes
document.getElementById('telstraToggle').onchange = (e) =>
  telstraLayer.setVisible(e.target.checked);
document.getElementById('mvnoToggle').onchange = (e) =>
  mvnoLayer.setVisible(e.target.checked);
document.getElementById('optusToggle').onchange = (e) =>
  optusLayer.setVisible(e.target.checked);
document.getElementById('vodaToggle').onchange = (e) =>
  vodaLayer.setVisible(e.target.checked);

// ---------- My location (live) ----------
const locLayer = new ol.layer.Vector({ source: new ol.source.Vector(), zIndex: 20 });
map.addLayer(locLayer);

const pin = new ol.Feature();
pin.setStyle(
  new ol.style.Style({
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: '#00e6a8' }),
      stroke: new ol.style.Stroke({ color: '#003b2f', width: 2 }),
    }),
  })
);

const acc = new ol.Feature();
acc.setStyle(
  new ol.style.Style({
    stroke: new ol.style.Stroke({ color: '#00e6a8', width: 1 }),
    fill: new ol.style.Fill({ color: 'rgba(0,230,168,0.12)' }),
  })
);

locLayer.getSource().addFeatures([acc, pin]);

document.getElementById('locBtn').onclick = () => {
  if (!navigator.geolocation) {
    badge('Geolocation not supported', 'bad');
    return;
  }
  badge('Locating…');
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const c = ol.proj.fromLonLat([longitude, latitude]);
      pin.setGeometry(new ol.geom.Point(c));
      const circle = ol.geom.Polygon.circular(
        ol.proj.get('EPSG:3857'),
        c,
        Math.max(accuracy, 25),
        64
      );
      acc.setGeometry(circle);
      view.animate({ center: c, duration: 250 });
      badge(
        `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(
          accuracy
        )} m)`,
        'ok'
      );
    },
    (err) => badge('Location error: ' + (err?.message || err), 'bad'),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
};

// ---------- Recenter AU ----------
document.getElementById('recenter').onclick = () =>
  view.animate({
    center: ol.proj.fromLonLat([133.7751, -25.2744]),
    zoom: 4.8,
    duration: 250,
  });

// iOS layout nudge (occasionally helps after fonts/controls paint)
setTimeout(() => map.updateSize(), 80);
setTimeout(() => map.updateSize(), 600);