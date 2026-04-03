const API_BASE = "https://YOUR-FLY-APP-NAME.fly.dev"; // <- change this
const REFRESH_MS = 30000;

let militaryOnly = false;
let allFeatures = [];
let lastAircraftRaw = [];

const statusBox = document.getElementById("statusBox");
const militaryToggle = document.getElementById("militaryToggle");
const refreshBtn = document.getElementById("refreshBtn");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const popupContainer = document.getElementById("popupContainer");
const popupEl = document.getElementById("popup");

const baseLayer = new ol.layer.Tile({
  source: new ol.source.OSM()
});

const aircraftSource = new ol.source.Vector();

const aircraftLayer = new ol.layer.Vector({
  source: aircraftSource,
  style: function(feature) {
    return makeAircraftStyle(feature);
  }
});

const map = new ol.Map({
  target: "map",
  layers: [baseLayer, aircraftLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]),
    zoom: 4,
    rotation: 0
  }),
  controls: ol.control.defaults.defaults({
    attribution: false
  })
});

const popupOverlay = new ol.Overlay({
  element: popupContainer,
  positioning: "bottom-center",
  stopEvent: false,
  offset: [0, -10]
});

map.addOverlay(popupOverlay);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getMarkerColor(ac) {
  const speed = Number(ac.speed || 0);
  const category = String(ac.category || "").toLowerCase();
  const operator = String(ac.operator || "").toLowerCase();
  const callsign = String(ac.callsign || "").toLowerCase();

  if (
    category.includes("military") ||
    operator.includes("air force") ||
    operator.includes("defence") ||
    operator.includes("defense") ||
    callsign.startsWith("raaf") ||
    callsign.startsWith("asy")
  ) {
    return "#9c27b0";
  }

  if (speed >= 420) return "#ff5252";
  if (speed <= 120) return "#ff9800";
  return "#00c853";
}

function makeAircraftStyle(feature) {
  const heading = Number(feature.get("heading") || 0);
  const fillColor = getMarkerColor(feature.getProperties());

  return new ol.style.Style({
    image: new ol.style.RegularShape({
      points: 3,
      radius: 10,
      rotation: (heading * Math.PI) / 180,
      fill: new ol.style.Fill({
        color: fillColor
      }),
      stroke: new ol.style.Stroke({
        color: "#ffffff",
        width: 1.5
      })
    }),
    text: new ol.style.Text({
      text: feature.get("callsign") || "",
      offsetY: 18,
      font: "12px Arial",
      fill: new ol.style.Fill({ color: "#ffffff" }),
      stroke: new ol.style.Stroke({ color: "rgba(0,0,0,0.7)", width: 3 })
    })
  });
}

function isMilitaryAircraft(ac) {
  const category = String(ac.category || "").toLowerCase();
  const operator = String(ac.operator || "").toLowerCase();
  const callsign = String(ac.callsign || "").toLowerCase();
  const aircraftType = String(ac.aircraft_type || "").toLowerCase();

  return (
    category.includes("military") ||
    operator.includes("air force") ||
    operator.includes("defence") ||
    operator.includes("defense") ||
    callsign.startsWith("raaf") ||
    callsign.startsWith("asy") ||
    aircraftType.startsWith("c17") ||
    aircraftType.startsWith("f35") ||
    aircraftType.startsWith("p8")
  );
}

function createAircraftFeature(ac) {
  if (ac.lat == null || ac.lon == null) return null;
  if (Number.isNaN(Number(ac.lat)) || Number.isNaN(Number(ac.lon))) return null;

  return new ol.Feature({
    geometry: new ol.geom.Point(ol.proj.fromLonLat([Number(ac.lon), Number(ac.lat)])),
    callsign: ac.callsign || "",
    hex: ac.hex || "",
    altitude: ac.altitude ?? "",
    speed: ac.speed ?? "",
    heading: ac.heading ?? 0,
    registration: ac.registration || "",
    aircraft_type: ac.aircraft_type || "",
    operator: ac.operator || "",
    origin: ac.origin || "",
    destination: ac.destination || "",
    squawk: ac.squawk || "",
    category: ac.category || "",
    source: ac.source || "",
    lat: ac.lat,
    lon: ac.lon,
    last_seen: ac.last_seen || ""
  });
}

function setStatus(text) {
  statusBox.textContent = text;
}

function clearPopup() {
  popupContainer.style.display = "none";
  popupOverlay.setPosition(undefined);
}

function showPopup(feature, coordinate) {
  const props = feature.getProperties();

  popupEl.innerHTML = `
    <div class="popup-title">${escapeHtml(props.callsign || "Unknown aircraft")}</div>
    <div class="popup-grid">
      <div class="popup-label">Registration</div><div>${escapeHtml(props.registration || "Unknown")}</div>
      <div class="popup-label">Type</div><div>${escapeHtml(props.aircraft_type || "Unknown")}</div>
      <div class="popup-label">Operator</div><div>${escapeHtml(props.operator || "Unknown")}</div>
      <div class="popup-label">Altitude</div><div>${escapeHtml(props.altitude || "Unknown")} ft</div>
      <div class="popup-label">Speed</div><div>${escapeHtml(props.speed || "Unknown")} kts</div>
      <div class="popup-label">Heading</div><div>${escapeHtml(props.heading || "0")}°</div>
      <div class="popup-label">Hex</div><div>${escapeHtml(props.hex || "Unknown")}</div>
      <div class="popup-label">Origin</div><div>${escapeHtml(props.origin || "Unknown")}</div>
      <div class="popup-label">Destination</div><div>${escapeHtml(props.destination || "Unknown")}</div>
      <div class="popup-label">Category</div><div>${escapeHtml(props.category || "Unknown")}</div>
      <div class="popup-label">Source</div><div>${escapeHtml(props.source || "Unknown")}</div>
      <div class="popup-label">Lat / Lon</div><div>${escapeHtml(props.lat)}, ${escapeHtml(props.lon)}</div>
    </div>
  `;

  popupContainer.style.display = "block";
  popupOverlay.setPosition(coordinate);
}

function renderAircraft(aircraft) {
  aircraftSource.clear();
  clearPopup();

  const filtered = militaryOnly ? aircraft.filter(isMilitaryAircraft) : aircraft;

  const features = filtered.map(createAircraftFeature).filter(Boolean);
  allFeatures = features;
  aircraftSource.addFeatures(features);

  const now = new Date().toLocaleTimeString();
  setStatus(`Aircraft shown: ${features.length} | Updated: ${now}`);
}

async function loadAircraft() {
  try {
    setStatus("Loading aircraft...");

    const url = militaryOnly
      ? `${API_BASE}/api/aircraft?military=1`
      : `${API_BASE}/api/aircraft`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const aircraft = Array.isArray(data.aircraft) ? data.aircraft : [];

    lastAircraftRaw = aircraft;
    renderAircraft(aircraft);
  } catch (err) {
    console.error("Aircraft load error:", err);
    setStatus(`Error loading aircraft: ${err.message}`);
  }
}

function searchAircraft() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;

  const match = allFeatures.find((feature) => {
    const props = feature.getProperties();
    return [
      props.callsign,
      props.registration,
      props.aircraft_type,
      props.operator,
      props.hex
    ]
      .map(v => String(v || "").toLowerCase())
      .some(v => v.includes(query));
  });

  if (!match) {
    setStatus(`No aircraft found for "${query}"`);
    return;
  }

  const geometry = match.getGeometry();
  const coordinate = geometry.getCoordinates();

  map.getView().animate({
    center: coordinate,
    zoom: Math.max(map.getView().getZoom(), 8),
    duration: 700
  });

  showPopup(match, coordinate);
  setStatus(`Found aircraft for "${query}"`);
}

militaryToggle.addEventListener("click", async () => {
  militaryOnly = !militaryOnly;
  militaryToggle.textContent = militaryOnly ? "Military Only: ON" : "Military Only: OFF";
  militaryToggle.classList.toggle("active", militaryOnly);
  await loadAircraft();
});

refreshBtn.addEventListener("click", loadAircraft);
searchBtn.addEventListener("click", searchAircraft);

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchAircraft();
  }
});

map.on("singleclick", function(evt) {
  let clicked = false;

  map.forEachFeatureAtPixel(evt.pixel, function(feature) {
    clicked = true;
    showPopup(feature, evt.coordinate);
    return true;
  });

  if (!clicked) {
    clearPopup();
  }
});

map.on("pointermove", function(evt) {
  const hit = map.hasFeatureAtPixel(evt.pixel);
  map.getTargetElement().style.cursor = hit ? "pointer" : "";
});

loadAircraft();
setInterval(loadAircraft, REFRESH_MS);
