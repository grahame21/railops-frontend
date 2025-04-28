// Initialize OpenLayers map
var map = new ol.Map({
  target: 'map', // ID of your <div>
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Start centered over Australia
    zoom: 4,
    rotation: 0 // Lock rotation (north always up)
  }),
  controls: ol.control.defaults({
    rotate: false, // Disable rotation control button
    attributionOptions: {
      collapsible: false
    }
  }),
  interactions: ol.interaction.defaults({
    altShiftDragRotate: false, // Disable drag-rotate with alt+shift
    pinchRotate: false // Disable rotate with two-finger pinch
  })
});

// Try to center map on user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var userLon = position.coords.longitude;
    var userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(11); // About 50 km radius
  }, function(error) {
    console.error('Geolocation error:', error);
  });
} else {
  console.error('Geolocation not supported');
}