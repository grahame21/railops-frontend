// === CONFIG ==========================
const BACKEND_URL = "https://railops-json.onrender.com/trains";
// ====================================

let map, vectorSource, vectorLayer, overlay;

function initMap() {
  vectorSource = new ol.source.Vector();

  vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: featureStyle
  });

  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({ source: new ol.source.OSM() }),
      vectorLayer
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([151.2093, -33.8688]), // Sydney
      zoom: 7
    })
  });

  // Popup overlay
  const popupEl = document.getElementById("popup");
  overlay = new ol.Overlay({
    element: popupEl,
    autoPan: { animation: { duration: 150 } },
    positioning: "bottom-center",
    stopEvent: true,
    offset: [0, -12]
  });
  map.addOverlay(overlay);

  document.getElementById("popup-close").addEventListener("click", () => {
    overlay.setPosition(undefined);
    popupEl.style.display = "none";
  });

  // Click to open popup
  map.on("singleclick", (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
    const popup = document.getElementById("popup");

    if (!feature) {
      overlay.setPosition(undefined);
      popup.style.display = "none";
      return;
    }

    const coord = evt.coordinate;
    const props = feature.get("props") || {};
    showPopup(coord, props);
  });

  // Optional: refresh data when map stops moving
  let moveTimer = null;
  map.on("moveend", () => {
    if (moveTimer) clearTimeout(moveTimer);
    moveTimer = setTimeout(fetchTrains, 300);
  });
}

function featureStyle(feature) {
  const props = feature.get("props") || {};
  const label = props.Loco || props.Service || "";

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 6,
      fill: new ol.style.Fill({ color: "red" }),
      stroke: new ol.style.Stroke({ color: "#fff", width: 2 })
    }),
    text: new ol.style.Text({
      text: label,
      offsetY: -12,
      font: "bold 12px Arial",
      fill: new ol.style.Fill({ color: "#000" }),
      stroke: new ol.style.Stroke({ color: "#fff", width: 2 })
    })
  });
}

function showPopup(coordinate, t) {
  // Build popup HTML from typical TF fields. We guard each field.
  const content = document.getElementById("popup-content");

  const rows = (label, val) => {
    if (val === undefined || val === null || val === "") return "";
    return `<tr><td>${label}</td><td>${val}</td></tr>`;
  };

  const title = (t.Loco || t.Service || t.Train || "Train").toString();
  const subtitle = [
    t.Operator || t.Customer || "",
    t.Direction || t.Dir || ""
  ].filter(Boolean).join(" • ");

  content.innerHTML = `
    <h3>${escapeHTML(title)}</h3>
    ${subtitle ? `<p class="meta">${escapeHTML(subtitle)}</p>` : ""}
    <table>
      ${rows("Status", safe(t.Status || t.State))}
      ${rows("Speed", t.Speed != null ? `${t.Speed} km/h` : undefined)}
      ${rows("Lat", t.Lat)}
      ${rows("Lon", t.Lon)}
      ${rows("From", safe(t.From))}
      ${rows("To", safe(t.To))}
      ${rows("Updated", safe(t.Updated || t.Time || t.Timestamp))}
      ${rows("Headcode", safe(t.Headcode || t.Code))}
      ${rows("Length", safe(t.Length))}
    </table>
  `;

  overlay.setPosition(coordinate);
  document.getElementById("popup").style.display = "block";
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safe(v) { return v == null ? "" : escapeHTML(v); }

function fetchTrains() {
  const view = map.getView();
  const zoom = view.getZoom();
  const center = ol.proj.toLonLat(view.getCenter());
  const lat = center[1];
  const lng = center[0];

  const url = `${BACKEND_URL}?lat=${lat}&lng=${lng}&zm=${zoom}`;

  fetch(url, { cache: "no-store" })
    .then(r => r.json())
    .then(payload => {
      if (!payload || payload.ok === false) {
        console.warn("Error loading trains:", payload && payload.message);
        vectorSource.clear();
        return;
      }
      renderTrains(payload.data);
    })
    .catch(err => {
      console.error("Fetch error:", err);
      vectorSource.clear();
    });
}

function renderTrains(json) {
  vectorSource.clear();

  // Expecting TrainFinder-like shape: { tts: [...] }
  const trains = (json && Array.isArray(json.tts)) ? json.tts : [];
  if (!trains.length) {
    console.log("No trains found.");
    return;
  }

  trains.forEach(t => {
    const lat = Number(t.Lat ?? t.lat);
    const lon = Number(t.Lon ?? t.lon ?? t.Lng ?? t.lng);
    if (!isFinite(lat) || !isFinite(lon)) return;

    const feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
      props: t
    });
    vectorSource.addFeature(feature);
  });

  console.log(`Rendered ${trains.length} train(s).`);
}

// Init & polling
initMap();
fetchTrains();
setInterval(fetchTrains, 30000); // 30s refresh
