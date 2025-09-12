const osm = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: '/tiles/osm/{z}/{x}/{y}.png',
    crossOrigin: 'anonymous'
  })
});

const rails = new ol.layer.Tile({
  visible: true,
  opacity: 0.9,
  source: new ol.source.XYZ({
    url: '/tiles/orm/{z}/{x}/{y}.png',
    crossOrigin: 'anonymous',
    attributions: '© OpenRailwayMap'
  })
});