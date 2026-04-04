let map;
let trainLayer;
let deferredPrompt = null;

function formatLocalDateTime(dateStr) {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function getTrainColor(speed) {
  const s = Number(speed || 0);
  if (s > 80) return "#ff3b30";
  if (s > 30) return "#34c759";
  if (s > 0) return "#9be15d";
  return "#ff9f0a";
}

function makeTrainStyle(train) {
  const color = getTrainColor(train.speed);

  return new ol.style.Style({
    image: new ol.style.Circle({
      radius: 8,
      fill: new ol.style.Fill({ color }),
      stroke: new ol.style.Stroke({
        color: "#ffffff",
        width: 2
      })
    })
  });
}

function buildTrainLabel(train) {
  const loco =
    train.loco ||
    train.train_name ||
    train.trainName ||
    train.trKey ||
    "";

  const trainNum =
    train.train_number ||
    train.trainNumber ||
    train.id ||
    train.ID ||
    "";

  if (loco && trainNum && loco !== trainNum) {
    return `${loco} • ${trainNum}`;
  }
  return loco || trainNum || "Train";
}

function isValidTrain(train) {
  const lat = Number(train.lat);
  const lon = Number(train.lon);
  return !Number.isNaN(lat) && !Number.isNaN(lon);
}

function updateTopBar(note, count, lastUpdated) {
  const statusEl = document.getElementById("statusNote");
  const countEl = document.getElementById("trainCountPill");
  const lastEl = document.getElementById("lastUpdatedPill");

  if (statusEl) statusEl.textContent = note || "ok";
  if (countEl) countEl.textContent = String(count ?? 0);
  if (lastEl) lastEl.textContent = `Last: ${formatLocalDateTime(lastUpdated)}`;
}

function createMap() {
  trainLayer = new ol.layer.Vector({
    source: new ol.source.Vector()
  });

  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      }),
      trainLayer
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([133.7751, -25.2744]),
      zoom: 4,
      rotation: 0
    }),
    controls: ol.control.defaults({
      rotate: false,
      attribution: true,
      zoom: true
    })
  });
}

async function loadTrains() {
  try {
    const url = `trains.json?_=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const trains = Array.isArray(data.trains) ? data.trains : [];

    const source = trainLayer.getSource();
    source.clear();

    let validCount = 0;

    trains.forEach((train) => {
      if (!isValidTrain(train)) return;

      const lat = Number(train.lat);
      const lon = Number(train.lon);

      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
        trainData: train,
        label: buildTrainLabel(train)
      });

      feature.setStyle(makeTrainStyle(train));
      source.addFeature(feature);
      validCount += 1;
    });

    const note = data.note || `ok - ${validCount} trains`;
    const lastUpdated = data.lastUpdated || new Date().toISOString();

    updateTopBar(note, validCount, lastUpdated);
  } catch (err) {
    console.error("Failed to load trains:", err);
    updateTopBar(`error - ${err.message}`, 0, null);
  }
}

function setupInstallPrompt() {
  const installBtn = document.getElementById("installBtn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove("hidden");
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.classList.add("hidden");
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.classList.add("hidden");
    deferredPrompt = null;
  });
}

function startAutoRefresh() {
  loadTrains();
  setInterval(loadTrains, 30000);
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof ol === "undefined") {
    alert("OpenLayers failed to load.");
    return;
  }

  createMap();
  setupInstallPrompt();
  startAutoRefresh();
});