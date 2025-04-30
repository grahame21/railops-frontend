console.log("main.js is running");

if (typeof ol === 'undefined') {
  alert("OpenLayers is missing");
} else {
  const map = new ol.Map({
    target: 'map',
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      })
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([133.7751, -25.2744]), // Australia center
      zoom: 4
    })
  });

  async function loadTrains() {
    console.log("Fetching live-trains.json...");

    try {
      const response = await fetch("live-trains.json");
      const data = await response.json();
      console.log("Train data loaded:", data);

      if (!Array.isArray(data.trains)) {
        console.warn("No valid trains array found.");
        return;
      }

      const features = data.trains.map(train => {
        const lat = parseFloat(train.lat);
        const lon = parseFloat(train.lon);
        const dir = parseFloat(train.direction || 0);

        if (isNaN(lat) || isNaN(lon)) {
          console.warn("Invalid coordinates for train:", train.id);
          return null;
        }

        const point = new ol.Feature({
          geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
          name: train.id
        });

        point.setStyle(new ol.style.Style({
          image: new ol.style.Icon({
            src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
            scale: 0.06,
            rotation: dir * Math.PI / 180
          })
        }));

        return point;
      }).filter(f => f !== null);

      const vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
          features: features
        })
      });

      map.addLayer(vectorLayer);
      console.log(`Train markers added: ${features.length}`);
    } catch (err) {
      console.error("Error fetching train data:", err);
    }
  }

  loadTrains();
}