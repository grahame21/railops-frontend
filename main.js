/* global ol */
(function(){
  function randToken(n=24){
    const abc='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s=''; for(let i=0;i<n;i++) s+=abc[Math.floor(Math.random()*abc.length)];
    return s;
  }
  function goto(url){ window.location.href=url; }
  const loginBtn = document.getElementById('loginBtn');
  const guestBtn = document.getElementById('guestBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const u = (document.getElementById('user').value||'').trim();
      const p = (document.getElementById('pass').value||'').trim();
      if (u.toLowerCase()==='admin') { goto('admin.html'); return; }
      const token = randToken();
      goto('dashboard.html?token='+encodeURIComponent(token));
    });
  }
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      const token = randToken();
      goto('dashboard.html?token='+encodeURIComponent(token));
    });
  }

  if (document.getElementById('map')) {
    const view = new ol.View({ center: ol.proj.fromLonLat([133.7751, -25.2744]), zoom: 4, constrainRotation: 0 });
    const map = new ol.Map({ target: 'map', layers: [new ol.layer.Tile({ source: new ol.source.OSM() })], view });
    map.getView().on('change:rotation', () => map.getView().setRotation(0));

    const railLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({ url: 'https://{a-c}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        attributions:'© OpenRailwayMap, © OpenStreetMap', maxZoom: 19 }),
      visible: true
    });
    const stationsLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({ url: 'https://{a-c}.tiles.openrailwaymap.org/stations/{z}/{x}/{y}.png',
        attributions:'© OpenRailwayMap, © OpenStreetMap', maxZoom: 19 }),
      visible: true
    });
    map.addLayer(railLayer); map.addLayer(stationsLayer);

    const ACCC_URL='https://spatial.infrastructure.gov.au/server/rest/services/ACCC_Mobile_Sites_and_Coverages/MapServer';
    function acccLayer(id){
      return new ol.layer.Tile({
        source:new ol.source.TileArcGISRest({ url:ACCC_URL, params:{layers:`show:${id}`,dpi:96,transparent:true,format:'png32'} }),
        opacity:0.45, visible:false
      });
    }
    const covTelstra=acccLayer(25), covOptus=acccLayer(15), covTPG=acccLayer(33), covAll=acccLayer(4);
    [covAll,covTelstra,covOptus,covTPG].forEach(l=>map.addLayer(l));

    const zoomSelect = document.getElementById('zoomSelect');
    const resetBtn   = document.getElementById('resetBtn');
    const layersBtn  = document.getElementById('layersBtn');
    const panel      = document.getElementById('layersPanel');
    const railChk    = document.getElementById('railChk');
    const stationsChk= document.getElementById('stationsChk');
    const telChk     = document.getElementById('covTelstra');
    const optChk     = document.getElementById('covOptus');
    const tpgChk     = document.getElementById('covTPG');
    const allChk     = document.getElementById('covAll');
    const locBtn     = document.getElementById('locBtn');
    const searchBox  = document.getElementById('searchBox');
    const lastUpdated= document.getElementById('lastUpdated');

    function fitAustralia(){
      const e=[112.0,-44.0,154.0,-10.0];
      map.getView().fit(ol.proj.transformExtent(e,'EPSG:4326','EPSG:3857'),{duration:500,padding:[40,40,40,40]});
    }
    function goToCurrent(){
      if(!navigator.geolocation){ fitAustralia(); return; }
      navigator.geolocation.getCurrentPosition(pos=>{
        const c=ol.proj.fromLonLat([pos.coords.longitude,pos.coords.latitude]);
        view.animate({ center:c, zoom: Math.max(view.getZoom(), 12), duration:600 });
      },()=>fitAustralia(),{enableHighAccuracy:true, timeout:10000});
    }

    zoomSelect.addEventListener('change', ()=> (zoomSelect.value==='current'?goToCurrent():fitAustralia()));
    resetBtn.addEventListener('click', ()=>{
      railChk.checked=stationsChk.checked=true;
      [telChk,optChk,tpgChk,allChk].forEach(c=>c.checked=false);
      railLayer.setVisible(true); stationsLayer.setVisible(true);
      covTelstra.setVisible(false); covOptus.setVisible(false); covTPG.setVisible(false); covAll.setVisible(false);
      fitAustralia();
    });
    layersBtn.addEventListener('click', ()=> panel.style.display = (panel.style.display==='none'?'block':'none'));
    // Close overlays when clicking on map (not when clicking UI)
    map.getViewport().addEventListener('click', (e)=>{
      const inUI = e.target.closest ? (e.target.closest('#layersPanel') || e.target.closest('.toolbar')) : null;
      if(!inUI){ panel.style.display='none'; }
    });

    railChk.addEventListener('change',()=>railLayer.setVisible(railChk.checked));
    stationsChk.addEventListener('change',()=>stationsLayer.setVisible(stationsChk.checked));
    telChk.addEventListener('change',()=>covTelstra.setVisible(telChk.checked));
    optChk.addEventListener('change',()=>covOptus.setVisible(optChk.checked));
    tpgChk.addEventListener('change',()=>covTPG.setVisible(tpgChk.checked));
    allChk.addEventListener('change',()=>covAll.setVisible(allChk.checked));
    locBtn.addEventListener('click', goToCurrent);

    const trainSource = new ol.source.Vector();
    const trainLayer = new ol.layer.Vector({
      source: trainSource,
      style: feature => {
        const heading = feature.get('heading') || 0;
        const tri = new ol.style.RegularShape({
          points: 3, radius: 10, rotation: (heading * Math.PI)/180,
          fill: new ol.style.Fill({ color: '#ffeb3b' }),
          stroke: new ol.style.Stroke({ color: '#1b1b1b', width: 1.4 })
        });
        return new ol.style.Style({ image: tri });
      }
    });
    map.addLayer(trainLayer);

    async function fetchJSON(url){ const res = await fetch(url, { cache: 'no-store' }); if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); }
    function featureFrom(lon,lat,props={}){ const f=new ol.Feature({ geometry:new ol.geom.Point(ol.proj.fromLonLat([lon,lat])) }); Object.entries(props).forEach(([k,v])=>f.set(k,v)); return f; }

    function extractFeatures(data){
      const feats=[];
      const push=(lon,lat,props)=>{
        if(typeof lon!=='number'||typeof lat!=='number')return;
        if(lat<-90||lat>90||lon<-180||lon>180)return;
        feats.push(featureFrom(lon,lat,props));
      };
      if (Array.isArray(data?.trains)) {
        data.trains.forEach(t=>push(t.lon??t.lng??t.longitude, t.lat??t.latitude, {
          id:t.id||t.label, label:t.label||t.name, heading:t.heading||t.bearing, loco:t.loco||t.locoNumber
        }));
      } else if (data?.atcsObj && typeof data.atcsObj==='object') {
        Object.values(data.atcsObj).forEach(o=>push(o.Lon??o.lon??o.lng, o.Lat??o.lat, {
          id:o.id||o.Name, label:o.Name, heading:o.H??o.heading, loco:o.Loco||o.loco
        }));
      } else if (Array.isArray(data)) {
        data.forEach(t=>push(t.lon??t.lng??t.longitude, t.lat??t.latitude, {
          id:t.id||t.label, label:t.label||t.name, heading:t.heading, loco:t.loco||t.locoNumber
        }));
      } else if (data && typeof data==='object') {
        for (const k of Object.keys(data)){
          const v=data[k]; if(Array.isArray(v)){
            v.forEach(t=>push(t.lon??t.lng??t.longitude, t.lat??t.latitude, {
              id:t.id||t.label, label:t.label||t.name, heading:t.heading, loco:t.loco||t.locoNumber
            }));
          }
        }
      }
      return feats;
    }

    function formatStamp(d){
      try{
        const date = d instanceof Date ? d : new Date(d);
        const t = date.toLocaleTimeString(undefined, { hour12:false });
        const short = Intl.DateTimeFormat(undefined, { timeZoneName:'short' }).formatToParts(date)
          .find(p=>p.type==='timeZoneName')?.value || '';
        return `${t} ${short}`;
      }catch(_){ return new Date().toLocaleTimeString(); }
    }

    async function refreshTrains(){
      try{
        const url = window.RAILOPS_TRAINS_URL || 'trains.json';
        const json = await fetchJSON(url);
        const feats = extractFeatures(json);
        trainSource.clear(true);
        trainSource.addFeatures(feats);
        window.__RAILOPS_INDEX__ = buildIndex(feats);
        // Last updated — prefer server-provided timestamp if present
        const stamp = json.last_updated || json.generated_at || Date.now();
        if (lastUpdated){ lastUpdated.textContent = 'Last updated: ' + formatStamp(stamp); }
        console.log('Trains loaded:', feats.length);
      }catch(e){
        if (lastUpdated){ lastUpdated.textContent = 'Last updated: failed to load'; }
        console.warn('Failed to load trains.json', e);
      }
    }

    function buildIndex(features){
      const idx = new Map();
      features.forEach(f=>{
        const fields = [f.get('id'), f.get('label'), f.get('loco')]
          .filter(Boolean).join(' ').toLowerCase();
        idx.set(f, fields);
      });
      return idx;
    }

    function searchAndZoom(q){
      q = (q||'').trim().toLowerCase();
      if(!q || !window.__RAILOPS_INDEX__) return false;
      let best = null;
      for (const [f, text] of window.__RAILOPS_INDEX__.entries()){
        if (text.includes(q)) { best = f; break; }
      }
      if (best){
        const geom = best.getGeometry();
        const coord = geom.getCoordinates();
        view.animate({ center: coord, zoom: Math.max(view.getZoom(), 12), duration: 500 });
        return true;
      }
      return false;
    }

    if (searchBox){
      searchBox.addEventListener('keydown', e=>{
        if(e.key==='Enter'){
          const ok = searchAndZoom(searchBox.value);
          if(!ok){
            const old = searchBox.placeholder;
            searchBox.value='';
            searchBox.placeholder = 'Train not found';
            setTimeout(()=> searchBox.placeholder=old, 1200);
          }
        }
      });
    }

    fitAustralia();
    refreshTrains();
    setInterval(refreshTrains, 60000);
  }

  const clockEl = document.getElementById('clock');
  if (clockEl){
    function tzOffsetStr(d){
      const offMin = -d.getTimezoneOffset();
      const sign = offMin>=0?'+':'-';
      const abs = Math.abs(offMin);
      const hh = String(Math.floor(abs/60)).padStart(1,'0');
      const mm = String(abs%60).padStart(2,'0');
      return `UTC${sign}${hh}:${mm}`;
    }
    function updateClock(){
      const d = new Date();
      const t = d.toLocaleTimeString(undefined, { hour12:false });
      const short = Intl.DateTimeFormat(undefined, { timeZoneName:'short' }).formatToParts(d)
        .find(p=>p.type==='timeZoneName')?.value || '';
      clockEl.textContent = `${t} ${short} (${tzOffsetStr(d)})`;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }
})();
