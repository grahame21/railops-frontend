(function () {
  const $ = id => document.getElementById(id);
  const status = $('status');
  const say = (m,tone) => { 
    status.textContent = m; 
    status.className = 'badge' + (tone ? (' ' + tone) : ''); 
    console.log('[dashboard]', m); 
  };

  // Guard & map DIV size sanity
  if (!window.ol || !ol.Map) { 
    say('❌ OpenLayers failed to load (CSP/CDN).', 'warn'); 
    return; 
  }
  const mapDiv = $('map');
  const rect = mapDiv.getBoundingClientRect();
  if (rect.height < 50) { 
    say('❌ Map container has no height — CSS issue', 'warn'); 
    return; 
  }

  // Base OSM
  const osm = new ol.layer.Tile({
    source: new ol.source.OSM({ crossOrigin: 'anonymous' })
  });
  osm.getSource().on('tileloaderror', () => {
    say('⚠️ OSM tile failed — add *.tile.openstreetmap.org to CSP img-src', 'warn');
  });

  // Rails (ORM)
  const rails = new ol.layer.Tile({
    visible: true,
    opacity: 0.9,
    source: new ol.source.XYZ({
      url: 'https://{a-c}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png',
      crossOrigin: 'anonymous',
      attributions: '© OpenRailwayMap'
    })
  });
  rails.getSource().on('tileloaderror', () => {
    say('⚠️ ORM tile failed — add *.tile.openrailwaymap.org to CSP img-src', 'warn');
  });

  // Carrier overlays
  function carrierLayer(url, rgba) {
    return new ol.layer.Vector({
      visible: true,
      opacity: .35,
      source: new ol.source.Vector({ url, format: new ol.format.GeoJSON() }),
      style: new ol.style.Style({
        fill: new ol.style.Fill({ color: rgba }),
        stroke: new ol.style.Stroke({ color: rgba, width: 1 })
      })
    });
  }
  const telstra      = carrierLayer('/assets/coverage/telstra.geojson',      'rgba( 77,163,255,0.35)');
  const telstraMVNO  = carrierLayer('/assets/coverage/telstra-mvno.geojson', 'rgba( 77,255,219,0.35)');
  const optus        = carrierLayer('/assets/coverage/optus.geojson',        'rgba(255,206, 77,0.35)');
  const voda         = carrierLayer('/assets/coverage/vodafone-tpg.geojson', 'rgba(255,102,102,0.35)');

  // North-up (disable rotation)
  const interactions = ol.interaction.defaults({ altShiftDragRotate:false, pinchRotate:false });

  // Map
  const view = new ol.View({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8 });
  const map = new ol.Map({
    target: 'map',
    view, interactions,
    layers: [osm, telstra, telstraMVNO, optus, voda, rails]
  });

  // Toggles
  $('tog-rails').onchange        = e => rails.setVisible(e.target.checked);
  $('tog-telstra').onchange      = e => telstra.setVisible(e.target.checked);
  $('tog-telstra-mvno').onchange = e => telstraMVNO.setVisible(e.target.checked);
  $('tog-optus').onchange        = e => optus.setVisible(e.target.checked);
  $('tog-voda').onchange         = e => voda.setVisible(e.target.checked);

  // Recenter AU
  $('btn-au').onclick = () =>
    view.animate({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8, duration: 450 });

  // My location
  const locLayer = new ol.layer.Vector({ source: new ol.source.Vector() });
  map.addLayer(locLayer);
  function dropPin(lon,lat){
    locLayer.getSource().clear();
    const f = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([lon,lat])));
    f.setStyle(new ol.style.Style({
      image: new ol.style.Icon({ anchor:[0.5,1], src:'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48"><path fill="#ff4d4d" d="M24 45s-14-14.2-14-24A14 14 0 1 1 38 21c0 9.8-14 24-14 24z"/><circle cx="24" cy="21" r="5.5" fill="#fff"/></svg>') })
    }));
    locLayer.getSource().addFeature(f);
    view.animate({ center: ol.proj.fromLonLat([lon,lat]), zoom: Math.max(view.getZoom()||4, 10), duration: 450 });
  }
  $('btn-locate').onclick = () => {
    if (!navigator.geolocation) return say('Geolocation not supported', 'warn');
    say('Locating…');
    navigator.geolocation.getCurrentPosition(
      p => { dropPin(p.coords.longitude, p.coords.latitude); say('Location updated', 'ok'); },
      e => say('Location denied/unavailable: '+(e?.message||e), 'warn'),
      { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
    );
  };

  // Zoom/DPR indicator
  const zi = $('zoomInfo');
  const refresh = () => { const z=view.getZoom(); zi.textContent = `z=${(z??'–').toFixed?.(2) ?? z ?? '–'} · DPR=${Math.round(devicePixelRatio||1)}`; };
  view.on('change:resolution', refresh); refresh();

  // Logout
  $('logout').onclick = () => { try{ document.cookie='railops_session=; Max-Age=0; path=/; SameSite=Lax'; }catch{} window.location.href='/login.html'; };

  // First paint
  map.once('rendercomplete', () => say('✅ Canvas rendered'));
})();