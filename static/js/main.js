// Initialize OpenLayers map
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Center Australia
    zoom: 4,
    rotation: 0 // Lock rotation (north up)
  }),
  controls: ol.control.defaults({
    rotate: false,
    attributionOptions: {
      collapsible: false
    }
  }),
  interactions: ol.interaction.defaults({
    altShiftDragRotate: false,
    pinchRotate: false
  })
});

// Center map on user's location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var userLon = position.coords.longitude;
    var userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(11); // Around 50km radius
  }, function(error) {
    console.error('Geolocation error:', error);
  });
} else {
  console.error('Geolocation not supported');
}

// Function to add live trains
function loadTrains() {
  fetch('trains.json?nocache=' + new Date().getTime()) // prevent caching
    .then(response => response.json())
    .then(data => {
      if (!data || !data.trains || !Array.isArray(data.trains)) {
        console.error('Invalid trains.json format');
        return;
      }

      // Clear previous layers except base
      map.getLayers().getArray().slice(1).forEach(layer => map.removeLayer(layer));

      // Add train markers
      data.trains.forEach(train => {
        if (!train.lon || !train.lat) return; // skip invalid

        var marker = new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat]))
        });

        var markerStyle = new ol.style.Style({
          image: new ol.style.Icon({
            anchor: [0.5, 1],
            src: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Train_font_awesome.svg', // simple train icon
            scale: 0.05
          })
        });

        marker.setStyle(markerStyle);

        var vectorSource = new ol.source.Vector({
          features: [marker]
        });

        var vectorLayer = new ol.layer.Vector({
          source: vectorSource
        });

        map.addLayer(vectorLayer);
      });
    })
    .catch(error => {
      console.error('Error loading trains:', error);
    });
}

// Load trains initially
loadTrains();

// Refresh trains every 30 seconds
setInterval(loadTrains, 30000);