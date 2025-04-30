// Check OpenLayers is loaded
if (typeof ol === 'undefined') {
  alert("Map failed to load: OpenLayers library is missing");
} else {
  // Init map
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

  // Function to load train markers
  async function loadTrains() {
    try {
      const res = await fetch('trains.json');
      const data = await res.json();

      const features = data.trains.map(train => {
        const coords = ol.proj.fromLonLat([train.lon, train.lat]);

        const iconFeature = new ol.Feature({
          geometry: new ol.geom.Point(coords),
          name: train.id,
          operator: train.operator,
          direction: train.direction
        });

        const iconStyle = new ol.style.Style({
          image: new ol.style.Icon({
            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            scale: 0.06,
            rotation: (train.direction || 0) * Math.PI / 180
          })
        });

        iconFeature.setStyle(iconStyle);
        return iconFeature;
      });

      const vectorSource = new ol.source.Vector({ features });
      const trainLayer = new ol.layer.Vector({ source: vectorSource });

      map.addLayer(trainLayer);
    } catch (err) {
      alert("Error loading train data.");
      console.error(err);
    }
  }

  loadTrains();
}