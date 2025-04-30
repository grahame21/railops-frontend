console.log("main.js is running");

// Ensure OpenLayers is loaded
if (typeof ol === 'undefined') {
  alert("Map failed to load: OpenLayers library is missing");
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
      zoom: 4,
      rotation: 0
    }),
    controls: ol.control.defaults({ rotate: false }),
    interactions: ol.interaction.defaults({
      altShiftDragRotate: false,
      pinchRotate: false
    })
  });

  async function loadTrains() {
    console.log("Attempting to load trains.json...");

    try {
      const res = await fetch('trains.json');
      const data = await res.json();
      console.log("Train data loaded:", data);

      if (!data.trains || data.trains.length === 0) {
        console.warn("No trains in the list.");
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
      console.error("Error loading train markers:", err);
    }
  }

  loadTrains();
}
