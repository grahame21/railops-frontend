// dashboard.js — OL + OSM/ORM with auto-fallback (direct → proxy)
(function () {
  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const say = (m, tone) => {
    if (status) { status.textContent = m; status.className = 'badge' + (tone ? (' ' + tone) : ''); }
    console.log('[dashboard]', m);
  };

  // ---- Guard: OL present and #map has height
  if (!window.ol || !ol.Map) { say('❌ OpenLayers failed to load (CSP/CDN)', 'warn'); return; }
  const mapDiv = $('map');
  if (!mapDiv) { console.warn('#map not found'); return; }
  if (mapDiv.getBoundingClientRect().height < 50) { say('❌ Map container has no height — CSS issue', 'warn'); return; }

  // ---- Helper: probe first working URL among candidates (img test)
  function probeFirst(candidates, timeoutMs = 4000) {
    return new Promise((resolve) => {
      let done = false;
      const timers = [];

      function finish(ok, url, note) {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        resolve({ ok, url, note });
      }

      candidates.forEach((u) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const probeUrl = u.replace('{z}/{x}/{y}', '5/27/19') + (u.includes('?') ? '&' : '?') + 't=' + Date.now();

        const t = setTimeout(() => {
          img.src = ''; // stop
          finish(false, null, 'timeout');
        }, timeoutMs);
        timers.push(t);

        img.onload = () => finish(true, u, 'loaded');
        img.onerror = () => finish(false, null, 'error');

        img.src = probeUrl;
      });
    });
  }

  // ---- Decide endpoints for OSM + ORM (direct then proxy)
  async function decideEndpoints() {
    // Direct hosts (use a.* for probe, then template with {a-c})
    const OSM_DIRECT = 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const OSM_PROBE  = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const OSM_PROXY  = '/tiles/osm/{z}/{x}/{y}.png';

    const ORM_DIRECT = 'https://{a-c}.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png';
    const ORM_PROBE  = 'https://a.tile.openrailwaymap.org/standard/{z}/{x}/{y}.png';
    const ORM_PROXY  = '/tiles/orm/{z}/{x}/{y}.png';

    const osmPick = await probeFirst([OSM_PROBE, OSM_PROXY]);
    const ormPick = await probeFirst([ORM_PROBE, ORM_PROXY]);

    const osmURL = osmPick.ok && osmPick.url.startsWith('https://a.tile.') ? OSM_DIRECT
                  : (osmPick.ok ? OSM_PROXY : OSM_PROXY);
    const ormURL = ormPick.ok && ormPick.url.startsWith('https://a.tile.') ? ORM_DIRECT
                  : (ormPick.ok ? ORM_PROXY : ORM_PROXY);

    let msg = 'Tile sources: ';
    msg += (osmURL === OSM_DIRECT ? 'OSM=direct' : 'OSM=proxy');
    msg += ' · ';
    msg += (ormURL === ORM_DIRECT ? 'ORM=direct' : 'ORM=proxy');
    say('✅ ' + msg, 'ok');

    if (osmPick.note === 'error' || osmPick.note === 'timeout') {
      say('⚠️ OSM direct blocked/unreachable — using proxy', 'warn');
    }
    if (ormPick.note === 'error' || ormPick.note === 'timeout') {
      say('⚠️ ORM direct blocked/unreachable — using proxy', 'warn');
    }

    return { osmURL, ormURL };
  }

  // ---- Build map after deciding sources
  (async () => {
    const { osmURL, ormURL } = await decideEndpoints();

    // Base OSM
    const osm = new ol.layer.Tile({
      source: new ol.source.OSM({
        url: osmURL,
        crossOrigin: 'anonymous'
      })
    });
    osm.getSource().on('tileloaderror', () => say('⚠️ OSM tile error (CSP/proxy)', 'warn'));

    // Rails (ORM)
    const rails = new ol.layer.Tile({
      visible: true,
      opacity: 0.9,
      source: new ol.source.XYZ({
        url: ormURL,
        crossOrigin: 'anonymous',
        attributions: '© OpenRailwayMap'
      })
    });
    rails.getSource().on('tileloaderror', () => say('⚠️ ORM tile error (CSP/proxy)', 'warn'));

    // Optional carrier overlays (local GeoJSONs; safe if absent)
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
    const telstra     = carrierLayer('/assets/coverage/telstra.geojson',      'rgba( 77,163,255,0.35)');
    const telstraMVNO = carrierLayer('/assets/coverage/telstra-mvno.geojson', 'rgba( 77,255,219,0.35)');
    const optus       = carrierLayer('/assets/coverage/optus.geojson',        'rgba(255,206, 77,0.35)');
    const voda        = carrierLayer('/assets/coverage/vodafone-tpg.geojson', 'rgba(255,102,102,0.35)');

    // Interactions: north-up
    const interactions = ol.interaction.defaults({ altShiftDragRotate:false, pinchRotate:false });

    const view = new ol.View({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8 });

    const map = new ol.Map({
      target: 'map',
      view, interactions,
      layers: [osm, telstra, telstraMVNO, optus, voda, rails]
    });

    // Toggles (bind only if elements exist)
    const bindToggle = (id, layer) => {
      const el = $(id);
      if (el) el.onchange = (e) => layer.setVisible(e.target.checked);
    };
    bindToggle('tog-rails', rails);
    bindToggle('tog-telstra', telstra);
    bindToggle('tog-telstra-mvno', telstraMVNO);
    bindToggle('tog-optus', optus);
    bindToggle('tog-voda', voda);

    // Recenter AU
    const btnAU = $('btn-au');
    if (btnAU) btnAU.onclick = () =>
      view.animate({ center: ol.proj.fromLonLat([133.7751,-25.2744]), zoom: 4.8, duration: 450 });

    // My location
    const locLayer = new ol.layer.Vector({ source: new ol.source.Vector() });
    map.addLayer(locLayer);
    function dropPin(lon,lat){
      locLayer.getSource().clear();
      const f = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat([lon,lat])));
      f.setStyle(new ol.style.Style({
        image: new ol.style.Icon({
          anchor:[0.5,1],
          src:'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48"><path fill="#ff4d4d" d="M24 45s-14-14.2-14-24A14 14 0 1 1 38 21c0 9.8-14 24-14 24z"/><circle cx="24" cy="21" r="5.5" fill="#fff"/></svg>')
        })
      }));
      locLayer.getSource().addFeature(f);
      view.animate({ center: ol.proj.fromLonLat([lon,lat]), zoom: Math.max(view.getZoom()||4, 10), duration: 450 });
    }
    const btnLocate = $('btn-locate');
    if (btnLocate) btnLocate.onclick = () => {
      if (!navigator.geolocation) return say('Geolocation not supported', 'warn');
      say('Locating…');
      navigator.geolocation.getCurrentPosition(
        p => { dropPin(p.coords.longitude, p.coords.latitude); say('Location updated', 'ok'); },
        e => say('Location denied/unavailable: '+(e?.message||e), 'warn'),
        { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
      );
    };

    // Zoom / DPR readout
    const zi = $('zoomInfo');
    const refresh = () => { const z=view.getZoom(); if (zi) zi.textContent = `z=${(z??'–').toFixed?.(2) ?? z ?? '–'} · DPR=${Math.round(devicePixelRatio||1)}`; };
    view.on('change:resolution', refresh); refresh();

    // Logout
    const logout = $('logout');
    if (logout) logout.onclick = () => { try{ document.cookie='railops_session=; Max-Age=0; path=/; SameSite=Lax'; }catch{} window.location.href='/login.html'; };

    // First paint
    map.once('rendercomplete', () => say('✅ Canvas rendered', 'ok'));
  })();
})();