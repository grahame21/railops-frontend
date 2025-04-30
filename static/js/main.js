// Initialize OpenLayers map
var map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]), // center on Australia
    zoom: 4,
    rotation: 0
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

// Try to center on user's current location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    const userLon = position.coords.longitude;
    const userLat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([userLon, userLat]));
    map.getView().setZoom(11); // 50 km radius approx
  });
}

// Load train data
fetch('/trains.json')
  .then(response => response.json())
  .then(data => {
    if (Array.isArray(data.trains)) {
      data.trains.forEach(train => {
        if (!train.lat || !train.lon) return;

        const feature = new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat]))
        });

        feature.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Simple_arrow_up.svg',
            scale: 0.05,
            rotation: 0 // rotation later from heading
          })
        }));

        const vectorSource = new ol.source.Vector({ features: [feature] });
        const vectorLayer = new ol.layer.Vector({ source: vectorSource });
        map.addLayer(vectorLayer);
      });
    }
  })
  .catch(error => console.error('Error loading trains:', error));