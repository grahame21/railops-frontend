// Basic OpenLayers map test (Australia view)
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