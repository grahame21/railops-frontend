// Initialize OpenLayers map
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Center over Australia initially
    zoom: 4,
    rotation: 0
  }),
  controls: ol.control.defaults({
    rotate: false,
    attributionOptions: { collapsible: false }
  }),
  interactions: ol.interaction.defaults({
    altShiftDragRotate: false,
    pinchRotate: false
  })
});

// Center map on user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var userLon = position.coords.longitude;
    var userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(11); // 50 km radius
  }, function(error) {
    console.error('Geolocation error:', error);
  });
} else {
  console.error('Geolocation not supported');
}

// Load trains.json
var vectorSource = new ol.source.Vector({});
var vectorLayer = new ol.layer.Vector({
  source: vectorSource
});
map.addLayer(vectorLayer);

// Function to load live trains
function loadTrains() {
  fetch('trains.json')
    .then(response => response.json())
    .then(data => {
      vectorSource.clear(); // Clear old trains

      if (data && data.tts && Array.isArray(data.tts)) {
        data.tts.forEach(train => {
          if (train.Latitude && train.Longitude) {
            var feature = new ol.Feature({
              geometry: new ol.geom.Point(ol.proj.fromLonLat([train.Longitude, train.Latitude]))
            });
            vectorSource.addFeature(feature);
          }
        });
      }
    })
    .catch(error => {
      console.error('Error loading trains.json:', error);
    });
}

// Initial load
loadTrains();

// Auto-refresh every 30 seconds
setInterval(loadTrains, 30000);