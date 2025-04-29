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

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(function(position) {
    var lon = position.coords.longitude;
    var lat = position.coords.latitude;
    map.getView().setCenter(ol.proj.fromLonLat([lon, lat]));
    map.getView().setZoom(11);
  });
}

function loadTrains() {
  fetch('trains.json?nocache=' + new Date().getTime())
    .then(response => response.json())
    .then(data => {
      map.getLayers().getArray().slice(1).forEach(layer => map.removeLayer(layer));

      if (data.trains) {
        data.trains.forEach(train => {
          if (!train.lon || !train.lat) return;
          var marker = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat]))
          });
          var markerStyle = new ol.style.Style({
            image: new ol.style.Icon({
              src: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Train_font_awesome.svg',
              scale: 0.05
            })
          });
          marker.setStyle(markerStyle);

          var vectorSource = new ol.source.Vector({
            features: [marker]
          });

          var markerLayer = new ol.layer.Vector({
            source: vectorSource
          });

          map.addLayer(markerLayer);
        });
      }
    });
}

loadTrains();
setInterval(loadTrains, 30000);