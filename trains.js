// trains.js — Train Tracker 2.0 (OpenLayers) — GitHub Pages data source

const TrainLayer = (() => {
  // 🔗 Your live JSON published via GitHub Pages
  // Make sure Pages is enabled on railops-backend (branch: main, folder: /)
  const DATA_URL = "https://grahame21.github.io/railops-backend/trains.json";

  const REFRESH_MS = 30_000;     // refresh every 30s
  const MAX_AGE_MIN = 120;       // fade to grey after 2h
  const ENABLE_POPUPS = true;
  const SHOW_HUD = true;         // small status box (top-right)
  const DEMO_IF_EMPTY = false;   // set to true to show 2 demo trains if feed empty

  let map, source, layer, popupOverlay, popupEl;
  const idIndex = new Map();

  const to3857 = (lon, lat) => ol.proj.fromLonLat([lon, lat]);
  const nowTs = () => Date.now();
  const pf = v => Number.isFinite(+v) ? +v : null;
  const heading = r => pf(r.heading ?? r.Heading ?? r.bearing ?? r.Bearing ?? r.course ?? r.Course) ?? 0;
  const speed   = r => pf(r.speed   ?? r.Speed   ?? r.velocity ?? r.Velocity);
  const id      = (r,i) => r.id||r.ID||r.Id||r.locoId||r.LocoId||r.LocomotiveId||r.Unit||r.Name||`train_${i}`;
  const lat     = r => pf(r.lat ?? r.Lat ?? r.latitude  ?? r.Latitude  ?? r.y ?? r.Y);
  const lon     = r => pf(r.lon ?? r.Lon ?? r.longitude ?? r.Longitude ?? r.x ?? r.X);
  const label   = r => r.label||r.Label||r.title||r.Title||r.loco||r.Loco||r.Locomotive||r.Service||r.ServiceNumber||r.Operator||r.operator||"";
  const operator= r => r.operator||r.Operator||r.company||r.Company||"";
  const upd     = r => { const c=r.timestamp||r.Timestamp||r.updated||r.Updated||r.LastSeen||r.lastSeen; const t=Date.parse(c||""); return Number.isNaN(t)?null:t; };
  const minsAgo = t => t==null?null:((nowTs()-t)/60000);

  // ---------- HUD ----------
  let hud;
  function ensureHud(){
    if (!SHOW_HUD || hud) return;
    hud = document.createElement("div");
    Object.assign(hud.style, {
      position:"absolute", right:"10px", top:"10px", zIndex: 15,
      background:"rgba(0,0,0,0.7)", color:"#fff", padding:"8px 10px",
      borderRadius:"8px", font:"600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial",
      maxWidth:"48vw", whiteSpace:"nowrap"
    });
    hud.textContent = "Live trains: init…";
    document.body.appendChild(hud);
  }
  function setHud(msg){ if(SHOW_HUD){ ensureHud(); hud.textContent = msg; } }

  // ---------- parsing helpers ----------
  function extract(d){
    if(!d) return [];
    if(Array.isArray(d)) return d;
    for(const k of ["trains","Trains","markers","Markers","items","Items","results","Results","features"]){
      if(Array.isArray(d[k])) return d[k];
    }
    if(d.type==="FeatureCollection" && Array.isArray(d.features)) return d.features;
    if(d.data)    return extract(d.data);
    if(d.payload) return extract(d.payload);
    for(const v of Object.values(d)){
      if(Array.isArray(v) && v.length && typeof v[0]==="object") return v;
    }
    return [];
  }

  function norm(r,i){
    if(r && r.type==="Feature" && r.geometry?.type==="Point"){
      const [lo,la]=r.geometry.coordinates||[]; const p=r.properties||{};
      return {id:id(p,i), lon:pf(lo), lat:pf(la), heading:heading(p), speed:speed(p), label:label(p), operator:operator(p), updatedAt:upd(p), raw:r};
    }
    return {id:id(r,i), lon:lon(r), lat:lat(r), heading:heading(r), speed:speed(r), label:label(r), operator:operator(r), updatedAt:upd(r), raw:r};
  }

  // ---------- styles & popups ----------
  function style(f){
    const age=f.get("ageMin"); const hd=f.get("heading")??0;
    let col=[0,120,255,0.9];
    if(age!=null){
      if(age>MAX_AGE_MIN) col=[130,130,130,0.7];
      else if(age>30)     col=[255,165,0,0.9];
    }
    return new ol.style.Style({
      image:new ol.style.RegularShape({
        points:3, radius:10, rotation:(hd*Math.PI)/180,
        fill:new ol.style.Fill({color:col}),
        stroke:new ol.style.Stroke({color:[0,0,0,0.6],width:1})
      }),
      text:new ol.style.Text({
        text:f.get("label")||"",
        offsetY:-18, font:"600 12px system-ui, sans-serif",
        fill:new ol.style.Fill({color:"#111"}),
        stroke:new ol.style.Stroke({color:"rgba(255,255,255,0.9)",width:3})
      })
    });
  }

  function ensurePopup(){
    if(!ENABLE_POPUPS || popupOverlay) return;
    popupEl=document.createElement("div"); popupEl.className="tt-popup";
    Object.assign(popupEl.style,{background:"white",padding:"8px 10px",borderRadius:"10px",boxShadow:"0 8px 24px rgba(0,0,0,0.2)",border:"1px solid rgba(0,0,0,0.1)",minWidth:"180px"});
    popupOverlay=new ol.Overlay({element:popupEl,autoPan:{animation:{duration:250}},offset:[0,-12],positioning:"bottom-center"});
    map.addOverlay(popupOverlay);
    map.on("singleclick",(evt)=>{
      let found=null;
      map.forEachFeatureAtPixel(evt.pixel,(f,l)=>{ if(l===layer) found=f; });
      if(!found){popupOverlay.setPosition(undefined);return;}
      const p=found.getProperties();
      const ut=p.updatedAt?new Date(p.updatedAt).toLocaleString():"unknown";
      popupEl.innerHTML =
        `<div style="font-weight:700">${p.label||p.id||"Unknown"}</div>
         <div>${p.operator||""}</div>
         <div>Speed: ${p.speed??"?"} | Heading: ${Math.round(p.heading??0)}°</div>
         <div>Updated: ${ut}</div>
         <div style="color:#666">(${p.lat?.toFixed?.(5)??"?"}, ${p.lon?.toFixed?.(5)??"?"})</div>`;
      popupOverlay.setPosition(found.getGeometry().getCoordinates());
    });
  }

  // ---------- feature upsert ----------
  function upsert(n){
    if(n.lat==null || n.lon==null) return;
    const key=String(n.id), coord=to3857(n.lon,n.lat), age=minsAgo(n.updatedAt);
    let f=idIndex.get(key);
    if(!f){
      f=new ol.Feature({geometry:new ol.geom.Point(coord),id:key});
      idIndex.set(key,f); source.addFeature(f);
    } else {
      f.getGeometry().setCoordinates(coord);
    }
    f.setProperties({
      label:n.label||key, operator:n.operator||"", speed:n.speed??null,
      heading:n.heading??0, updatedAt:n.updatedAt??null, lon:n.lon, lat:n.lat, ageMin:age??null
    }, true);
    f.setStyle(style(f));
  }

  function addDemoIfEmpty(){
    if(!DEMO_IF_EMPTY) return 0;
    const demo = [
      {id:"NSW001", lon:151.2093, lat:-33.8688, heading:95, label:"Demo NSW", operator:"NSW"},
      {id:"VIC001", lon:144.9631, lat:-37.8136, heading:10, label:"Demo VIC", operator:"VIC"},
    ];
    demo.forEach(upsert);
    return demo.length;
  }

  // ---------- refresh loop ----------
  async function refresh(){
    ensureHud();
    const t0 = Date.now();
    try{
      const url = `${DATA_URL}${DATA_URL.includes("?") ? "&" : "?"}t=${t0}`;
      const res = await fetch(url, {cache:"no-store"});
      const http = res.status;
      if(!res.ok){
        setHud(`Live trains: HTTP ${http} — fetch failed`);
        console.error("[TrainLayer] fetch error", res.status, res.statusText);
        return;
      }
      let rawText = await res.text();
      let raw;
      try { raw = JSON.parse(rawText); }
      catch (e) {
        const preview = rawText.trim().slice(0,180).replace(/\s+/g,' ');
        setHud(`Live trains: HTTP ${http} — not JSON (${preview || "empty"})`);
        console.error("[TrainLayer] parse error: not JSON. Preview:", preview);
        return;
      }

      const list = extract(raw).map(norm).filter(r=>r.lat!=null&&r.lon!=null);
      const seen = new Set();
      for(const n of list){ upsert(n); seen.add(String(n.id)); }

      source.getFeatures().forEach(f=>f.setStyle(style(f)));

      let count = list.length;
      if (count === 0) count += addDemoIfEmpty();

      const ms = Date.now() - t0;
      const timeStr = new Date().toLocaleTimeString();
      setHud(`Live trains: ${count} • updated ${timeStr} • ${ms}ms`);
      console.log("[TrainLayer] update:", {count, ms, source: DATA_URL});
    }catch(e){
      setHud(`Live trains: error — see console`);
      console.error("[TrainLayer] refresh error:", e);
    }
  }

  // ---------- one-time CSS ----------
  function ensureCssOnce(){
    if(document.getElementById("tt-css")) return;
    const s=document.createElement("style"); s.id="tt-css";
    s.textContent = `
      .tt-popup{user-select:text}
      .tt-popup:after{
        content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
        border-width:8px 8px 0 8px;border-style:solid;border-color:white transparent transparent transparent;
        filter:drop-shadow(0 2px 2px rgba(0,0,0,0.1));
      }`;
    document.head.appendChild(s);
  }

  // ---------- public API ----------
  return {
    init(olMap){
      map=olMap; ensureCssOnce(); ensureHud();
      source=new ol.source.Vector();
      layer=new ol.layer.Vector({source, zIndex:20, renderBuffer:512});
      map.addLayer(layer);
      ensurePopup();
      refresh();
      setInterval(refresh, REFRESH_MS);
      console.log("[TrainLayer] started. Source:", DATA_URL);
    }
  };
})();
