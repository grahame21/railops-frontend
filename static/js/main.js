alert("main.js is working");

// Initialize OpenLayers map
var map = new ol.Map({
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

// Optional: zoom to user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(pos) {
    const lon = pos.coords.longitude;
    const lat = pos.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([lon, lat]));
    map.getView().setZoom(10);
  }, function(err) {
    console.warn("Geolocation error:", err.message);
  });
}