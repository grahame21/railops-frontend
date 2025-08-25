/* global L */
const STATUS = document.getElementById("status");
const LOG = document.getElementById("log");
const ZOOM_INPUT = document.getElementById("zoom-input");

function setStatus(txt) {
  STATUS.textContent = txt;
}

function logLine(...args) {
  const s = args.map(a => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ");
  LOG.textContent = `[${new Date().toISOString()}] ${s}\n` + LOG.textContent;
}

const map = L.map("map").setView([-33.86, 151.21], parseInt(ZOOM_INPUT.value, 10) || 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const layerGroup = L.layerGroup().addTo(map);

function bboxFromMap(m) {
  const b = m.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return {
    swlat: sw.lat,
    swlng: sw.lng,
    nelat: ne.lat,
    nelng: ne.lng
  };
}

async function fetchTrains() {
  const center = map.getCenter();
  const zoom = map.getZoom();
  const bbox = bboxFromMap(map);

  const qs = new URLSearchParams({
    swlat: bbox.swlat.toFixed(5),
    swlng: bbox.swlng.toFixed(5),
    nelat: bbox.nelat.toFixed(5),
    nelng: bbox.nelng.toFixed(5),
    lat: center.lat.toFixed(5),
    lng: center.lng.toFixed(5),
    zm: String(zoom)
  });

  const url = `/trains?${qs.toString()}`;
  setStatus(`Fetching… z=${zoom} center=(${center.lat.toFixed(3)},${center.lng.toFixed(3)})`);
  logLine("GET", url);

  try {
    const r = await fetch(url, { headers: { "Accept": "application/json" }});
    const data = await r.json();

    if (!r.ok) {
      logLine("ERROR", data);
      setStatus(`Error: ${data?.error || r.status}`);
      return;
    }

    renderTrains(data);
  } catch (e) {
    logLine("Fetch failed:", String(e));
    setStatus("Network error");
  }
}

function renderTrains(payload) {
  layerGroup.clearLayers();

  // TrainFinder JSON varies; commonly there’s a 'tts' array for train traces/items.
  const trains = Array.isArray(payload?.tts) ? payload.tts
               : Array.isArray(payload) ? payload
               : [];

  if (!trains.length) {
    setStatus("No trains in view");
    logLine("No trains found in payload keys:", Object.keys(payload || {}));
    return;
  }

  // Heuristic: item may have lat/lng or nested location; adapt if needed.
  let count = 0;
  trains.forEach(t => {
    const lat = (t.lat ?? t.Lat ?? t.latitude ?? t?.loc?.lat);
    const lng = (t.lng ?? t.Lng ?? t.longitude ?? t?.loc?.lng);
    if (typeof lat === "number" && typeof lng === "number") {
      const label = t.name || t.descr || t.id || "train";
      L.circleMarker([lat, lng], { radius: 5 })
        .bindPopup(`<b>${label}</b><br/>(${lat.toFixed(4)}, ${lng.toFixed(4)})`)
        .addTo(layerGroup);
      count++;
    }
  });

  setStatus(`${count} train${count === 1 ? "" : "s"} in view`);
  logLine(`Rendered ${count} markers`);
}

// Map events
map.on("moveend", () => {
  ZOOM_INPUT.value = map.getZoom();
  fetchTrains();
});

// Controls
document.getElementById("btn-here").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation not available");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], Math.max(map.getZoom(), 12));
    },
    err => setStatus("Geolocation denied")
  );
});

document.getElementById("btn-refresh").addEventListener("click", fetchTrains);
ZOOM_INPUT.addEventListener("change", () => {
  const z = Math.min(18, Math.max(3, parseInt(ZOOM_INPUT.value || "10", 10)));
  map.setZoom(z);
});

// Initial load
fetchTrains();
