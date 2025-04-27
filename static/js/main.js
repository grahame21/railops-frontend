let map;
let trainLayer;
let trainSource;
let refreshInterval;
let trainsVisible = true;

function initMap() {
    trainSource = new ol.source.Vector();

    trainLayer = new ol.layer.Vector({
        source: trainSource
    });

    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            trainLayer
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([134.5, -25]), // Centered on Australia
            zoom: 4.5
        })
    });

    loadTrains();
    refreshInterval = setInterval(loadTrains, 30000); // Refresh every 30 seconds
}

function loadTrains() {
    fetch('/static/assets/trains.json')
        .then(response => response.json())
        .then(data => {
            trainSource.clear();
            data.forEach(train => {
                if (!train.lon || !train.lat) return;
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([train.lon, train.lat])),
                    name: train.loco,
                    speed: train.speed
                });

                const color = getSpeedColor(train.speed);

                feature.setStyle(new ol.style.Style({
                    image: new ol.style.RegularShape({
                        fill: new ol.style.Fill({ color: color }),
                        stroke: new ol.style.Stroke({ color: '#fff', width: 1 }),
                        points: 3,
                        radius: 10,
                        rotation: train.heading ? train.heading * Math.PI / 180 : 0,
                        angle: 0
                    })
                }));

                trainSource.addFeature(feature);
            });
        })
        .catch(error => console.error('Error loading trains:', error));
}

function getSpeedColor(speed) {
    if (speed >= 115) {
        return 'blue'; // Very Fast
    } else if (speed >= 80) {
        return 'green'; // Fast
    } else if (speed >= 40) {
        return 'yellow'; // Moderate
    } else {
        return 'red'; // Slow
    }
}

function toggleTrains() {
    trainsVisible = !trainsVisible;
    trainLayer.setVisible(trainsVisible);
}

function toggleCoverage() {
    alert("Coverage maps coming soon!");
}

window.onload = initMap;