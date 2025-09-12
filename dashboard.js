// dashboard.js
// Basic OpenLayers init with OSM + ORM proxied layers

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';

// OSM (proxied via Netlify function)
const osm = new TileLayer({
  source: new OSM({
    url: '/api/tiles/osm/{z}/{x}/{y}.png',
    crossOrigin: 'anonymous'
  })
});

// ORM (proxied via Netlify function)
const rails = new TileLayer({
  visible: true,
  opacity: 0.9,
  source: new XYZ({
    url: '/api/tiles/orm/{z}/{x}/{y}.png',
    crossOrigin: 'anonymous',
    attributions: '© OpenRailwayMap'
  })
});

const map = new Map({
  target: 'map',
  layers: [osm, rails],
  view: new View({
    center: [0, 0], // update with your AU coords
    zoom: 5
  })
});