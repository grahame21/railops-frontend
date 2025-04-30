console.log("main.js is running");

if (typeof ol === 'undefined') {
  alert("OpenLayers is missing");
} else {
  const map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([133.7751, -25.2744]),
      zoom: 4
    })
  });

  async function loadTrains() {
    console.log("Loading live-trains.json...");
    try {
      const res = await fetch('live-trains.json');
      const data = await res.json();
      console.log("Trains loaded:", data.trains);

      if (!Array.isArray(data.trains)) {
        console.warn("Invalid train list.");
        return;
      }

      const features = data.trains.map(train => {
        const lat = parseFloat(train.lat);
        const lon = parseFloat(train.lon);
        const dir = parseFloat(train.direction || 0);

        if (isNaN(lat) || isNaN(lon)) {
          console.warn("Invalid coordinates for train:", train.id);
          return null;
        }

        const coords = ol.proj.fromLonLat([lon, lat]);
        const feature = new ol.Feature(new ol.geom.Point(coords));

        feature.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            scale: 0.06,
            rotation: dir * Math.PI / 180
          })
        }));

        return feature;
      }).filter(f => f !== null);

      const vectorSource = new ol.source.Vector({ features });
      const layer = new ol.layer.Vector({ source: vectorSource });
      map.addLayer(layer);

      console.log("Train markers added:", features.length);
    } catch (err) {
      console.error("Failed to load train data:", err);
    }
  }

  loadTrains();
}