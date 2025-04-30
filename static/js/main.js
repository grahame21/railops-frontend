console.log("main.js is running");

if (typeof ol === 'undefined') {
  alert("Map failed to load: OpenLayers library missing");
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
    console.log("Attempting to load trains.json...");

    try {
      const res = await fetch('live-trains.json');
      const data = await res.json();
      console.log("Train data loaded:", data);

      if (!data.trains || !Array.isArray(data.trains)) {
        console.warn("No valid trains found.");
        return;
      }

      const features = data.trains.map(train => {
        const coords = ol.proj.fromLonLat([train.lon, train.lat]);

        const feature = new ol.Feature({
          geometry: new ol.geom.Point(coords),
          name: train.id
        });

        feature.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            scale: 0.06,
            rotation: (train.direction || 0) * Math.PI / 180
          })
        }));

        return feature;
      });

      const vectorSource = new ol.source.Vector({ features });
      const trainLayer = new ol.layer.Vector({ source: vectorSource });
      map.addLayer(trainLayer);

    } catch (err) {
      console.error("Failed to load trains.json:", err);
    }
  }

  loadTrains();
}
