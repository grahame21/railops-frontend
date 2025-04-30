// Initialize map
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // Australia center
    zoom: 4,
    rotation: 0
  }),
  controls: ol.control.defaults({ rotate: false }),
  interactions: ol.interaction.defaults({
    altShiftDragRotate: false,
    pinchRotate: false
  })
});

// Load train data
fetch('trains.json')
  .then(response => response.json())
  .then(data => {
    if (!data.trains || data.trains.length === 0) return;

    const features = data.trains.map(train => {
      const feature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat])),
        name: train.label
      });

      // Directional arrow style
      const iconStyle = new ol.style.Style({
        image: new ol.style.Icon({
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Red_triangle_arrow_up.svg',
          scale: 0.05,
          rotation: (train.dir || 0) * Math.PI / 180,
          rotateWithView: true
        }),
        text: new ol.style.Text({
          text: train.label || '',
          offsetY: -25,
          fill: new ol.style.Fill({ color: '#fff' }),
          stroke: new ol.style.Stroke({ color: '#000', width: 2 })
        })
      });

      feature.setStyle(iconStyle);
      return feature;
    });

    const vectorSource = new ol.source.Vector({
      features: features
    });

    const vectorLayer = new ol.layer.Vector({
      source: vectorSource
    });

    map.addLayer(vectorLayer);
  });

// Try to center map on user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var userLon = position.coords.longitude;
    var userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(10);
  });
}