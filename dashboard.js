(function () {
  const $ = id => document.getElementById(id);
  const status = $('status') || { textContent:'', className:'' };
  const say = (m,tone) => { status.textContent = m; status.className = tone||''; console.log('[dashboard]', m); };

  if (!window.ol || !ol.Map) { say('❌ OpenLayers failed to load', 'warn'); return; }

  const mapDiv = $('map'); const r = mapDiv?.getBoundingClientRect?.(); 
  if (!mapDiv || !r || r.height < 50) { say('❌ Map container has no height', 'warn'); return; }

  const osm = new ol.layer.Tile({
    source: new ol.source.XYZ({ url: '/tiles/osm/{z}/{x}/{y}.png', crossOrigin: 'anonymous' })
  });

  const rails = new ol.layer.Tile({
    visible: true, opacity: 0.9,
    source: new ol.source.XYZ({
      url: '/tiles/orm/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap'
    })
  });

  const view = new ol.View({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8 });
  const map = new ol.Map({
    target: 'map',
    view,
    layers: [osm, rails],
    interactions: ol.interaction.defaults({ altShiftDragRotate:false, pinchRotate:false })
  });

  $('tog-rails') && ($('tog-rails').onchange = e => rails.setVisible(e.target.checked));
  $('btn-au') && ($('btn-au').onclick = () => view.animate({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8, duration: 450 }));

  map.once('rendercomplete', () => say('✅ Canvas rendered'));
})();