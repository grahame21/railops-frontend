// URL of your backend (Render)
const BACKEND_URL = "https://railops-json.onrender.com/trains";

let map, vectorSource, vectorLayer;

function initMap() {
  vectorSource = new ol.source.Vector();

  vectorLayer = new ol.layer.Vector({
    source: vectorSource
  });

  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      }),
      vectorLayer
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([151.2093, -33.8688]), // Sydney
      zoom: 7
    })
  });
}

function fetchTrains() {
  // Use current map center + zoom
  const view = map.getView();
  const zoom = view.getZoom();
  const center = ol.proj.toLonLat(view.getCenter());

  const url = `${BACKEND_URL}?lat=${center[1]}&lng=${center[0]}&zm=${zoom}`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        console.warn("Error loading trains:", data.message);
        return;
      }
      renderTrains(data.data);
    })
    .catch(err => console.error("Fetch error:", err));
}

function renderTrains(json) {
  vectorSource.clear();

  if (!json.tts || json.tts.length === 0) {
    console.log("No trains found in payload.");
    return;
  }

  json.tts.forEach(train => {
    if (!train.Lat || !train.Lon) return;

    const feature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([train.Lon, train.Lat])),
      name: train.Loco || "Unknown"
    });

    feature.setStyle(new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: "red" }),
        stroke: new ol.style.Stroke({ color: "#fff", width: 2 })
      }),
      text: new ol.style.Text({
        text: train.Loco || "",
        offsetY: -12,
        font: "bold 12px Arial",
        fill: new ol.style.Fill({ color: "#000" }),
        stroke: new ol.style.Stroke({ color: "#fff", width: 2 })
      })
    }));

    vectorSource.addFeature(feature);
  });

  console.log("Rendered", json.tts.length, "train(s).");
}

// Initialize
initMap();
fetchTrains();
setInterval(fetchTrains, 30000); // refresh every 30s
