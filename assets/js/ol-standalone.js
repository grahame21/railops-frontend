(function(){
  const s = document.getElementById('status');
  const say = (m)=>{ s.textContent = m; };

  if (!window.ol || !ol.Map) {
    say('❌ OpenLayers failed to load (CSP/CDN)');
    return;
  }

  const map = new ol.Map({
    target: 'map',
    layers: [ new ol.layer.Tile({ source: new ol.source.OSM({ crossOrigin:'anonymous' }) }) ],
    view: new ol.View({
      center: ol.proj.fromLonLat([133.7751,-25.2744]), // Australia
      zoom: 4.8
    }),
    interactions: ol.interaction.defaults({ altShiftDragRotate:false, pinchRotate:false })
  });

  map.once('rendercomplete', ()=> say('✅ OpenLayers + base map rendered'));
})();