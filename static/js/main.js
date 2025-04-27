// Initialize map
const map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([133.7751, -25.2744]),
    zoom: 5
  })
});

let trainLayer; // Global layer for toggling

// Function to load trains
function loadTrains() {
  fetch('/trains.json')
    .then(response => response.json())
    .then(data => {
      if (trainLayer) {
        map.removeLayer(trainLayer);
      }

      const features = data.map(train => {
        const speed = train.speed || 0;
        let color = 'gray';
        if (speed > 115) color = 'blue';
        else if (speed > 90) color = 'green';
        else if (speed > 60) color = 'yellow';
        else if (speed > 30) color = 'orange';
        else if (speed > 0) color = 'red';

        return new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat])),
          name: train.name,
          style: new ol.style.Style({
            image: new ol.style.Circle({
              radius: 6,
              fill: new ol.style.Fill({ color }),
              stroke: new ol.style.Stroke({ color: 'black', width: 1 })
            })
          })
        });
      });

      trainLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
          features: features
        }),
        style: feature => feature.get('style')
      });

      map.addLayer(trainLayer);
    })
    .catch(error => {
      console.error('Error loading trains:', error);
    });
}

// Load initially and refresh every 30 sec
loadTrains();
setInterval(loadTrains, 30000);