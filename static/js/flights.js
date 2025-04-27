let flightMap;
let aircraftLayer;
let aircraftSource;
let aircraftVisible = true;

function initFlightMap() {
    aircraftSource = new ol.source.Vector();

    aircraftLayer = new ol.layer.Vector({
        source: aircraftSource
    });

    flightMap = new ol.Map({
        target: 'flight-map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            aircraftLayer
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([134.5, -25]), // Australia center
            zoom: 4.5
        })
    });

    loadAircraft();
    setInterval(loadAircraft, 30000); // Refresh aircraft every 30s
}

function loadAircraft() {
    fetch('https://adsbx-flight-scraper.onrender.com/flights')
        .then(response => response.json())
        .then(data => {
            aircraftSource.clear();
            data.forEach(plane => {
                if (!plane.lon || !plane.lat) return;
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([plane.lon, plane.lat])),
                    name: plane.callsign || "Unknown"
                });

                feature.setStyle(new ol.style.Style({
                    image: new ol.style.Icon({
                        src: '/static/assets/plane-icon.png',
                        scale: 0.05,
                        rotation: plane.track ? plane.track * Math.PI / 180 : 0
                    })
                }));

                aircraftSource.addFeature(feature);
            });
        })
        .catch(error => console.error('Error loading aircraft:', error));
}

function toggleMilitary() {
    alert("Military filtering coming soon!");
}

window.onload = initFlightMap;