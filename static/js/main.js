// Initialize OpenLayers map
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM() // OpenStreetMap background
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Centered on Australia
    zoom: 4,
    rotation: 0 // North always up
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

// Try to center map on user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var userLon = position.coords.longitude;
    var userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(11); // About 50km radius
  }, function(error) {
    console.error('Geolocation error:', error);
  });
} else {
  console.error('Geolocation not supported');
}

// Load live trains from trains.json
fetch('/trains.json')
  .then(response => response.json())
  .then(data => {
    if (data && data.trains && Array.isArray(data.trains)) {
      data.trains.forEach(train => {
        var coords = ol.proj.fromLonLat([train.lon, train.lat]);
        var marker = new ol.Feature(new ol.geom.Point(coords));
        marker.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src: '/static/assets/train_icon.png', // Put your small train icon here
            scale: 0.05
          })
        }));

        var vectorSource = new ol.source.Vector({
          features: [marker]
        });

        var vectorLayer = new ol.layer.Vector({
          source: vectorSource
        });

        map.addLayer(vectorLayer);
      });
    }
  })
  .catch(error => {
    console.error('Error loading trains.json:', error);
  });