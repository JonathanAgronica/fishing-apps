/* ===================== Map tab ===================== */
(function(){
'use strict';
const $=id=>document.getElementById(id);const FT=window.FT,B=window.BT,D=window.BAFFLE_DATA,S=FT.spots;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KP='mbj_map';const pref=Object.assign({layer:'sat',colour:'off'},(()=>{try{return JSON.parse(localStorage.getItem(KP))||{}}catch(e){return{}}})());
const savePref=()=>{try{localStorage.setItem(KP,JSON.stringify(pref));}catch(e){}};
const E0=Date.UTC(2025,11,31,14),Q=15*60e3,TZ='Australia/Brisbane';
const hToMs=h=>E0+h*3600e3,msToH=ms=>(ms-E0)/3600e3;
const fT=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace(' am','am').replace(' pm','pm');
const dayKey=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(ms));
const fWhen=h=>{const ms=hToMs(h);const today=dayKey(Date.now())===dayKey(ms),tom=dayKey(Date.now()+864e5)===dayKey(ms);
  return (today?'':tom?'tomorrow ':new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short'}).format(new Date(ms))+' ')+fT(ms);};
const scoreColor=s=>FTRamp(s);
let LF=null,map=null,base={},sysG,creekG,tickG,lmG,myG,colG,meM=null,meC=null,watch=null,addMode=false,ready=false,loading=null;
const markers=new Map();
const GEN=!!B.generic;
const GAUGES=GEN?(B.SYS.gauges||[]).filter(g=>!g.coastal&&g.km!=null).map(g=>({name:g.name+' (gauge '+g.id+')',km:g.km,line:g.line})):[{name:'Essendean Bridge gauge 039267',km:35.25,line:'B'},{name:'Hills Rd gauge 539135 (Euleilah Ck)',km:25.24,line:'E'},{name:'Winfield (MSQ tide place)',km:3.4,line:'B'}];
const LL=GEN?B.LINES.map(L=>({id:L.id,a:L.id==='M'?0:L.j,b:L.j+L.len,coords:L.coords})):null; /* generic channel list */
function hint(html,ms){const h=$('mHint');if(!html){h.style.display='none';return;}h.innerHTML=html;h.style.display='block';clearTimeout(hint.t);if(ms)hint.t=setTimeout(()=>h.style.display='none',ms);}
/* ---- lazy-load vendored Leaflet (precached by the service worker → works offline) ---- */
function loadLeaflet(){if(loading)return loading;
  loading=new Promise((res,rej)=>{if(!document.querySelector('link[data-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='vendor/leaflet/leaflet.css';l.dataset.leaflet='1';document.head.appendChild(l);}
    const s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=()=>{LF=window.L.noConflict();res();};s.onerror=()=>{loading=null;rej(new Error('map library failed to load'));};document.head.appendChild(s);});
  return loading;}
async function init(){if(ready)return;try{await loadLeaflet();}catch(e){$('mMap').innerHTML='<div class="mload">⚠ '+esc(e.message)+' — connect once so it can be cached for offline use.</div>';return;}
  if(ready)return;$('mMap').innerHTML='';
  map=LF.map('mMap',{zoomControl:true,tapHold:true,preferCanvas:false,maxZoom:19,minZoom:9});
  base.sat=LF.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,maxNativeZoom:18,crossOrigin:true,
    attribution:'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> — Esri, Maxar, Earthstar Geographics, GIS User Community'});
  base.osm=LF.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true,
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'});
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  creekG=LF.layerGroup().addTo(map);colG=LF.layerGroup().addTo(map);tickG=LF.layerGroup().addTo(map);const labG=LF.layerGroup().addTo(map);lmG=LF.layerGroup().addTo(map);myG=LF.layerGroup().addTo(map);
  // creek centreline (always drawn — works offline without tiles)
  sysG=LF.layerGroup().addTo(map);
  const main=GEN?[]:D.main.slice(0),eu=GEN?[]:D.euleilah.slice(0);
  for(const ln of (GEN?LL.map(L=>L.coords):[main,eu])){LF.polyline(ln,{color:'#03141a',weight:7,opacity:.75,interactive:false}).addTo(creekG);LF.polyline(ln,{color:'#5cc8ff',weight:3.5,opacity:.95,interactive:false}).addTo(creekG);}
  /* Baffle side creeks + Euleilah above 31.4 km: estimated tides → dashed overlay */
  if(!GEN&&B.SIDES){const est=[];for(const sd of B.SIDES){LF.polyline(sd.pts,{color:'#03141a',weight:6,opacity:.7,interactive:false}).addTo(creekG);LF.polyline(sd.pts,{color:'#5cc8ff',weight:2.6,opacity:.9,interactive:false}).addTo(creekG);est.push(sd.pts);}
    const eE=[];for(let x=B.EUCAL;x<=S.EUMAX+1e-9;x+=0.1)eE.push(S.pointAt(Math.min(x,S.EUMAX),'E'));est.push(eE);
    for(const ln of est)LF.polyline(ln,{color:'#ffd27a',weight:1.4,opacity:.95,dashArray:'4 5',interactive:false}).addTo(creekG);}
  // km ticks: every 1 km (dot), labels every 2 km
  if(GEN&&B.TWO){/* two-entrance passage: km both ways on the passage, junction-relative km on side creeks */
    const sh=n=>n.replace(/ Creek/,' Ck').replace(/\s*\(.*\)/,'');
    for(const L of LL){if(L.id==='M'){for(let k=0;k<=Math.floor(L.b);k++){const p=S.pointAt(k,'M');LF.circleMarker(p,{radius:k%2?2:3,color:'#fff',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
        if(k%2===0)LF.marker(p,{icon:LF.divIcon({className:'mkm mk2',html:k+' S · '+Math.round(B.TWO.L-k)+' N',iconSize:[70,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}}
      else{const nm=sh(B.lineName(L.id));for(let k=1;k<=Math.floor(L.b-L.a+1e-6);k++){const p=S.pointAt(L.a+k,L.id);LF.circleMarker(p,{radius:k%2?2:3,color:'#ffd27a',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
        LF.marker(p,{icon:LF.divIcon({className:'mkm mkms',html:esc(nm)+' '+k+' km',iconSize:[100,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}}}
    map.fitBounds(LF.latLngBounds(LL.flatMap(L=>L.coords)).pad(0.05));}
  else if(GEN){for(const L of LL)for(let k=Math.ceil(L.a);k<=Math.floor(L.b);k++){if(L.id!=='M'&&k<=L.a+0.2)continue;const p=S.pointAt(k,L.id);LF.circleMarker(p,{radius:k%2?2:3,color:'#fff',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
    if(k%2===0)LF.marker(p,{icon:LF.divIcon({className:'mkm',html:k+' km',iconSize:[40,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}
    map.fitBounds(LF.latLngBounds(LL.flatMap(L=>L.coords)).pad(0.05));}
  else{
  for(let k=0;k<=B.MAXKM;k++){const p=S.pointAt(k,'B');LF.circleMarker(p,{radius:k%2?2:3,color:'#fff',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
    if(k%2===0)LF.marker(p,{icon:LF.divIcon({className:'mkm',html:k+' km',iconSize:[40,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}
  for(let k=Math.ceil(D.euleilahJunctionKm);k<=Math.floor(S.EUMAX);k++){const p=S.pointAt(k,'E');LF.circleMarker(p,{radius:k%2?2:3,color:'#fff',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
    if(k%2===0)LF.marker(p,{icon:LF.divIcon({className:'mkm',html:k+' km',iconSize:[40,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}
  /* side creeks: km markers from the junction ("Mosquito Ck 2 km") */
  for(const sd of (B.SIDES||[]))for(let k=1;k<=Math.floor(sd.len+1e-6);k++){const p=B.pointOnSide(sd.jk+k,sd.id);LF.circleMarker(p,{radius:k%2?2:3,color:'#ffd27a',weight:1,fillColor:'#03141a',fillOpacity:1,interactive:false}).addTo(tickG);
    LF.marker(p,{icon:LF.divIcon({className:'mkm mkms',html:esc(sd.short)+' '+k+' km',iconSize:[90,12],iconAnchor:[-6,6]}),interactive:false,keyboard:false}).addTo(labG);}
  const fit=[];for(let k=0;k<=B.MAXKM;k+=0.5)fit.push(S.pointAt(k,'B'));map.fitBounds(LF.latLngBounds(fit.concat(eu)).pad(0.03));}
  drawSystems();
  const lg=LF.control({position:'bottomleft'});lg.onAdd=()=>{const d=LF.DomUtil.create('div','mtleg');d.innerHTML=Object.values(S.TYPES).map(T=>`<span><b style="background:${T.col}">${T.s}</b>${T.n}</span>`).join('')+`<span><b style="background:${S.GENCOL}">•</b>General</span>`;LF.DomEvent.disableClickPropagation(d);return d;};lg.addTo(map);
  setLayer(pref.layer);drawSpots();
  map.on('contextmenu',e=>addAt(e.latlng));
  map.on('click',e=>{if(addMode){addAt(e.latlng);setAdd(false);}});
  const zt=()=>{const z=map.getZoom();for(const [g,min] of [[tickG,12],[labG,13]]){if(z<min)map.removeLayer(g);else if(!map.hasLayer(g))g.addTo(map);}};map.on('zoomend',zt);zt();
  ready=true;document.body.dataset.mapReady='1';
  $('mColour').value=pref.colour;colourSetup();}
function setLayer(l){pref.layer=l;savePref();for(const k in base)if(map.hasLayer(base[k]))map.removeLayer(base[k]);if(base[l])base[l].addTo(map);
  document.querySelectorAll('#mLayers button').forEach(b=>b.classList.toggle('on',b.dataset.l===l));}
/* ---- spots on the map ---- */
function pinIcon(l,sc){const T=S.TYPES[l.type];const c=T?T.col:(l.color||S.GENCOL);
  return LF.divIcon({className:'mpin-wrap',html:`<div class="mpin${T?' typed':''}" style="background:${c}"></div><b class="mpin-t${T&&T.s.length>2?' l3':''}">${T?T.s:'•'}</b>${sc!=null?`<span class="mpin-sc" style="background:${scoreColor(sc)};color:${FTRamp.ink(sc)}">${sc}</span>`:''}${S.DEPTHS[l.depth]?`<span class="mpin-d">${S.DEPTHS[l.depth].s}</span>`:''}`,iconSize:[26,26],iconAnchor:[13,28],popupAnchor:[0,-26]});}
function depthTag(l){const D=S.DEPTHS[l.depth];return D?`<span class="tag mdep">⚓ ${D.n}</span>`:'';}
function depthSel(v){return `<div class="mut">Depth</div><select class="mdp"><option value="">— unset —</option>${Object.entries(S.DEPTHS).map(([k,D])=>`<option value="${k}"${v===k?' selected':''}>${D.n} (${D.k})</option>`).join('')}</select>`;}
function typeTag(l){const T=S.TYPES[l.type];return T?`<span class="ttag" style="background:${T.col}">${T.s}</span>`:'';}
function typeSel(cur){return `<div class="mtype">${[['','General'],...Object.entries(S.TYPES).map(([k,T])=>[k,T.n+' ('+T.s+')'])].map(([k,n])=>`<button type="button" data-t="${k}" class="${k===(cur||'')?'on':''}" style="--tc:${k?S.TYPES[k].col:S.GENCOL}"><i></i>${n}</button>`).join('')}</div>`;}
function wireType(box,st){box.querySelectorAll('.mtype button').forEach(b=>b.onclick=()=>{st.type=b.dataset.t;box.querySelectorAll('.mtype button').forEach(x=>x.classList.toggle('on',x===b));});}
function drawSpots(){if(!map)return;lmG.clearLayers();myG.clearLayers();markers.clear();
  for(const g of GAUGES){const m=LF.marker(S.pointAt(g.km,g.line),{icon:LF.divIcon({className:'mpin-wrap',html:'<div class="mgauge"></div>',iconSize:[14,14],iconAnchor:[7,7]}),title:g.name,zIndexOffset:-100}).addTo(lmG);
    m.bindTooltip(esc(g.name),{direction:'top',offset:[0,-6]});m.on('click',()=>openSpot(S.nearest(g.km,g.line,0.05)||{name:g.name,km:g.km,line:g.line,builtin:true,gauge:true},m));}
  for(const l of S.all()){if(l.custom){const m=LF.marker([l.lat,l.lng],{icon:pinIcon(l,pinScore(l)),draggable:true,title:l.name,autoPan:true,zIndexOffset:500}).addTo(myG);
      m.bindTooltip(esc(l.name),{direction:'top',offset:[0,-22]});
      m.on('click',()=>openSpot(S.get(l.id),m));
      m.on('dragend',()=>{const p=m.getLatLng();try{const u=S.update(l.id,{lat:p.lat,lng:p.lng});hint(`📍 <b>${esc(u.name)}</b> moved → ${S.kmLabel(u.km,u.line)}`,4000);}catch(e){m.setLatLng([l.lat,l.lng]);hint('⚠ '+esc(e.message),4000);}});
      markers.set(l.id,m);}
    else{const m=LF.circleMarker(S.latLng(l),{radius:7,color:'#fff',weight:2,fillColor:l.alias?'#ffd38a':'#0b3b3a',fillOpacity:.95}).addTo(lmG);
      m.bindTooltip(esc(l.name),{direction:'top',offset:[0,-6]});m.on('click',()=>openSpot(S.get(l.id),m));markers.set(l.id,m);}}
  if(FT.cross)try{FT.cross.drawMap(LF,map);}catch(e){console.error('crossings',e);}}
/* ---- popup: next high / low / run-in start + bite score ---- */
function spotInfo(l){const o=Object.assign({},FT.baffleOpts?FT.baffleOpts():{},GEN?{line:l.line||'M'}:l.line?{line:l.line}:{});const nh=msToH(Date.now());
  const P=B.predictAt(l.km,nh-3,nh+30,o);const ext=P.ext.filter(e=>!e.weak);
  const hi=ext.find(e=>e.hi&&e.t>nh),lo=ext.find(e=>!e.hi&&e.t>nh),sd=P.ext.find(e=>e.stand&&e.standT1>nh&&(!hi||e.t<hi.t+1));
  const R=B.runInStarts(l.km,nh-3,nh+30,o);const cur=R.filter(r=>r.t<=nh&&nh-r.t<=2).pop(),nxt=R.find(r=>r.t>nh);
  let sc=null;try{const ll=S.latLng(l);const c=FT.biteCtx({lat:ll[0],lng:ll[1],km:l.km,line:l.line,sys:FT.SYS,stype:S.typeOf(l)},Date.now(),Date.now()+Q);sc=c&&c.slots[0];}catch(e){}
  const v=P.curve(nh),v2=P.curve(nh+0.25);
  return{P,hi,lo,sd,cur,nxt,sc,now:v,trend:v==null||v2==null?null:v2>v+0.005?'rising':v2<v-0.005?'falling':'slack',cal:P.cal};}
function popHtml(l){const I=spotInfo(l);const u=x=>` <span class="mut">±${Math.round(x)}′</span>`;
  const tag=typeTag(l)+depthTag(l)+(l.custom?'<span class="tag mine">my spot</span>':l.alias?`<span class="tag">renamed · ${esc(l.base)}</span>`:'');
  return `<div class="mpop" data-km="${l.km}"><h3>${esc(l.name)} ${tag}</h3>
   <div class="mut">${S.kmLabel(l.km,l.line)}${l.custom&&l.offKm>0.05?` · pin ${Math.round(l.offKm*1000)} m off centreline`:''}${l.note?'<br>📝 '+esc(l.note):''}</div>
   <table>
    <tr><td>🔺 Next high</td><td class="mhi"><b>${I.hi?fWhen(I.hi.t):'—'}</b>${I.hi?u(I.hi.u)+` <span class="mut">${I.hi.h.toFixed(2)} m</span>`:''}</td></tr>
    ${I.sd?`<tr><td>🌗 Tide stand</td><td class="mut"><b style="color:#c9d7d4">${fWhen(I.sd.standT0)}–${fT(hToMs(I.sd.standT1))}</b> slack, no rise — single-high day: the small high doesn’t reach here</td></tr>`:''}
    <tr><td>🔻 Next low</td><td class="mlo"><b>${I.lo?fWhen(I.lo.t):'—'}</b>${I.lo?u(I.lo.u)+` <span class="mut">${I.lo.h.toFixed(2)} m${I.cal.trunc?' pool':''}</span>`:''}</td></tr>
    <tr><td>🎣 Run-in start</td><td class="mri">${I.cur?`<b>now</b> (started ${fWhen(I.cur.t)}${u(I.cur.u)})${I.nxt?'<br>next ':''}`:''}${I.nxt?`<b>${fWhen(I.nxt.t)}</b>${u(I.nxt.u)}${I.nxt.kind==='rise'?' <span class="mut">water starts rising</span>':''}`:(I.cur?'':'— <span class="mut">(neap: tide not reaching)</span>')}</td></tr>
    ${S.TYPES[l.type]?`<tr><td colspan="2" class="mut">${esc(S.TYPES[l.type].n)} spot — its bite score favours the ${esc(S.TYPES[l.type].n.toLowerCase())} at this spot</td></tr>`:''}<tr><td>🐟 Bite score now</td><td class="msc">${I.sc?`<b class="rbadge" style="background:${scoreColor(I.sc.score)};color:${FTRamp.ink(I.sc.score)}">${I.sc.score}</b> <span class="mut">${esc(I.sc.tl||'')}</span>`:'—'}</td></tr>
    <tr><td>🌊 Now</td><td>${I.now!=null?I.now.toFixed(2)+' m AHD, '+I.trend:'—'}</td></tr>
    ${FT.lureHtml?(()=>{const ll=S.latLng(l);const h=FT.lureHtml({depth:l.depth,km:l.km,line:l.line||null,lat:ll[0],lng:ll[1]},Date.now());return h?`<tr><td>🎨 Lure now</td><td class="mlure">${h.replace(/^<div class="lure1"[^>]*>🎨 /,'<div class="lure1">')}</td></tr>`:'';})():''}
   </table>
   <div class="b"><button class="pri" data-a="bite">🎣 Bite times here</button><button data-a="tides">🌊 Tides here</button><button data-a="log">📝 Log catch here</button>
   ${l.custom?'<button data-a="edit">✏️ Edit</button>':l.id?'<button data-a="alias">✏️ Rename</button>':''}</div><div class="medit"></div></div>`;}
let openM=null;
function openSpot(l,m){if(!l)return;openM=m;m.unbindPopup();m.bindPopup(popHtml(l),{maxWidth:300,autoPanPadding:[20,60]}).openPopup();wirePopup(l,m);}
function wirePopup(l,m){const el=m.getPopup().getElement();if(!el)return;
  el.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>action(b.dataset.a,l,m,el));}
function goBite(l){const ll=S.latLng(l);FT.biteSetLoc(Object.assign({name:l.name+' — '+(FT.SYSSHORT||'Baffle Ck'),lat:ll[0],lng:ll[1],tz:TZ,baffleKm:l.km,spotId:l.id||null},GEN?{baffleLine:l.line,sys:FT.SYS}:{}));FT.showTab('bite');}
function action(a,l,m,el){
  if(a==='bite'){map.closePopup();goBite(l);}
  else if(a==='tides'){map.closePopup();FT.baffleSelect(l.km,l.name,l.line);FT.showTab('baffle');}
  else if(a==='log'){map.closePopup();FT.catchLogAt&&FT.catchLogAt(l);}
  else if(a==='edit')editForm(l,m,el);
  else if(a==='alias'){const box=el.querySelector('.medit');box.innerHTML=`<input type="text" class="mnm" maxlength="60" value="${esc(l.name)}" placeholder="${esc(l.base)}"><div class="b"><button class="pri" data-x="ok">Save name</button>${l.alias?'<button data-x="reset">Reset to “'+esc(l.base)+'”</button>':''}</div>`;
    box.querySelector('[data-x=ok]').onclick=()=>{S.setAlias(l.id,box.querySelector('.mnm').value);reopen(l.id);};
    const r=box.querySelector('[data-x=reset]');if(r)r.onclick=()=>{S.setAlias(l.id,'');reopen(l.id);};box.querySelector('.mnm').focus();}}
function reopen(id){const l=S.get(id);const m=markers.get(id);if(l&&m)openSpot(l,m);}
function swatches(cur){return `<div class="sw">${S.COLORS.map(c=>`<span data-c="${c}" style="background:${c}" class="${c===cur?'on':''}"></span>`).join('')}</div>`;}
function wireSw(box,st){box.querySelectorAll('.sw span').forEach(s=>s.onclick=()=>{st.color=s.dataset.c;box.querySelectorAll('.sw span').forEach(x=>x.classList.toggle('on',x===s));});}
function editForm(l,m,el){const box=el.querySelector('.medit');const st={type:S.typeOf(l)};
  box.innerHTML=`<input type="text" class="mnm" maxlength="60" value="${esc(l.name)}" placeholder="Spot name"><input type="text" class="mnt" maxlength="200" value="${esc(l.note||'')}" placeholder="Note (optional)"><div class="mut">Spot type</div>${typeSel(st.type)}${depthSel(l.depth||'')}
   <div class="b"><button class="pri" data-x="ok">Save</button><button data-x="del">🗑 Delete</button></div><div class="mut">Drag the pin to move it.</div>`;wireType(box,st);
  box.querySelector('[data-x=ok]').onclick=()=>{S.update(l.id,{name:box.querySelector('.mnm').value,note:box.querySelector('.mnt').value,type:st.type,depth:box.querySelector('.mdp').value});reopen(l.id);};
  box.querySelector('[data-x=del]').onclick=()=>{if(!confirm(`Delete “${l.name}”?`))return;map.closePopup();S.remove(l.id);hint('🗑 Spot deleted',2500);};
  box.querySelector('.mnm').focus();}
/* ---- add a spot ---- */
function addAt(ll){let sn;try{sn=S.snap(ll.lat,ll.lng);}catch(e){return;}
  const pop=LF.popup({maxWidth:300}).setLatLng(ll);
  if(sn.offKm>1.2){pop.setContent(`<div class="mpop">That point is ${sn.offKm.toFixed(1)} km from the creek centreline — custom spots must be within 1.2 km of ${GEN?esc(FT.SYSNAME)+'’s mapped channels':'Baffle Creek or one of its mapped side creeks'}. <span id="mOther"></span></div>`).openOn(map);
    if(FT.nearestSystems)FT.nearestSystems(ll.lat,ll.lng).then(N=>{const b=N[0],e=document.getElementById('mOther');if(e&&b&&b.s.id!==FT.SYS&&b.d<1.2){e.innerHTML=`It’s on <b>${esc(b.s.name)}</b> — <button class="sm pri">Switch to it</button>`;e.querySelector('button').onclick=()=>FT.switchSystem(b.s.id);}}).catch(()=>{});return;}
  const near=S.nearest(sn.km,sn.line,0.3);const st={type:''};
  pop.setContent(`<div class="mpop"><h3>➕ New spot</h3><div class="mut">Snaps to <b>${S.kmLabel(sn.km,sn.line)}</b> for tides (${Math.round(sn.offKm*1000)} m from centreline)${near?' · near '+esc(near.name):''}</div>
    <input type="text" class="mnm" maxlength="60" placeholder="Name e.g. Snag bend"><input type="text" class="mnt" maxlength="200" placeholder="Note (optional)"><div class="mut">Spot type — which stage of the tide it fishes best</div>${typeSel(st.type)}${depthSel('')}
    <div class="b"><button class="pri" data-x="ok">💾 Save spot</button><button data-x="no">Cancel</button>${FT.cross?'<button data-x="xc">⚠ Shallow crossing here</button>':''}</div></div>`).openOn(map);
  const el=pop.getElement();wireType(el,st);const nm=el.querySelector('.mnm');setTimeout(()=>nm.focus(),50);
  const ok=()=>{try{const l=S.add({lat:ll.lat,lng:ll.lng,name:nm.value,note:el.querySelector('.mnt').value,type:st.type,depth:el.querySelector('.mdp').value});map.closePopup();setTimeout(()=>reopen(l.id),50);}catch(e){hint('⚠ '+esc(e.message),4000);}};
  el.querySelector('[data-x=ok]').onclick=ok;nm.onkeydown=e=>{if(e.key==='Enter')ok();};el.querySelector('[data-x=no]').onclick=()=>map.closePopup();const xc=el.querySelector('[data-x=xc]');if(xc)xc.onclick=()=>{map.closePopup();FT.cross.addForm(ll);};}
function setAdd(on){addMode=on;$('mAdd').classList.toggle('on',on);if(on)hint('Tap the map near the creek to drop a spot…');else hint('');if(map)map.getContainer().style.cursor=on?'crosshair':'';}
/* ---- my position ---- */
function me(){if(!navigator.geolocation){hint('No GPS on this device.',3000);return;}
  if(watch!=null){navigator.geolocation.clearWatch(watch);watch=null;}
  hint('<span class="spin"></span> Finding you…');let first=true;
  watch=navigator.geolocation.watchPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude],acc=p.coords.accuracy;
    if(!meM){meM=LF.marker(ll,{icon:LF.divIcon({className:'mpin-wrap',html:'<div class="mme"></div>',iconSize:[20,20],iconAnchor:[10,10]}),zIndexOffset:1000,interactive:false}).addTo(map);meC=LF.circle(ll,{radius:acc,color:'#3b8fff',weight:1,fillOpacity:.1,interactive:false}).addTo(map);}
    else{meM.setLatLng(ll);meC.setLatLng(ll).setRadius(acc);}
    const sn=S.snap(ll[0],ll[1]);const n=sn.offKm<=1.2?S.nearest(sn.km,sn.line,1.0):null;
    hint(`📍 You: ±${Math.round(acc)} m · ${sn.offKm<=1.2?`${S.kmLabel(sn.km,sn.line)} (${Math.round(sn.offKm*1000)} m off)${n?` · nearest spot <b>${esc(n.name)}</b>`:''}`:sn.offKm.toFixed(1)+' km from the creek'}`);
    if(first){first=false;map.setView(ll,Math.max(map.getZoom(),14));if(sn.offKm>1.2&&FT.suggestSystem)FT.suggestSystem(ll[0],ll[1]);}},
    e=>hint('GPS failed: '+esc(e.message),4000),{enableHighAccuracy:true,timeout:20000,maximumAge:30000});}
function stopMe(){if(watch!=null){navigator.geolocation.clearWatch(watch);watch=null;}}
/* ---- colour the creek by bite score / tide stage at a chosen time ---- */
const cache={};
function dayStartMs(){const k=dayKey(Date.now());const [y,m,d]=k.split('-').map(Number);return Date.UTC(y,m-1,d)-10*3600e3;}
function segs(){if(GEN){const tot=LL.reduce((a,L)=>a+L.b-L.a,0),st=tot>70?2:1,out=[];for(const L of LL)for(let a=L.a;a<L.b-0.05;a+=st){const b=Math.min(a+st,L.b);out.push({km:(a+b)/2,line:L.id,a,b});}return out;}
  const out=[];for(let k=0;k<B.MAXKM;k+=1)out.push({km:k+0.5,line:'B',a:k,b:k+1});
  for(let k=Math.floor(D.euleilahJunctionKm);k<S.EUMAX;k+=1){const a=Math.max(k,D.euleilahJunctionKm),b=Math.min(k+1,S.EUMAX);if(b-a>0.05)out.push({km:(a+b)/2,line:'E',a,b});}
  for(const sd of (B.SIDES||[]))for(let a=sd.jk;a<sd.max-0.05;a+=1){const b=Math.min(a+1,sd.max);out.push({km:(a+b)/2,line:sd.id,a,b});}return out;}
function segLine(s){const pts=[];for(let x=s.a;x<=s.b+1e-9;x+=0.1)pts.push(S.pointAt(Math.min(x,s.b),s.line));pts.push(S.pointAt(s.b,s.line));return pts;}
function stageAt(s,t){const key='t'+dayKey(t)+s.line+s.km+JSON.stringify(FT.baffleOpts?FT.baffleOpts():{});const d0=dayStartMs();
  let c=cache[key];if(!c){const o=Object.assign({},FT.baffleOpts?FT.baffleOpts():{},{line:s.line});const h0=msToH(d0);c=cache[key]={P:B.predictAt(s.km,h0-14,h0+38,o),R:B.runInStarts(s.km,h0-14,h0+38,o)};}
  const h=msToH(t);if(c.R.some(r=>h>=r.t&&h<=r.t+2))return 'runin';const v=c.P.curve(h),v2=c.P.curve(h+0.25);if(v==null||v2==null)return 'none';
  if(c.P.cal.trunc&&v<=Math.min(...c.P.ext.filter(e=>!e.hi).map(e=>e.h))+0.03)return 'pool';return v2>v+0.004?'rising':v2<v-0.004?'falling':'slack';}
function pinScore(l){if(pref.colour!=='bite'||!S.TYPES[l.type]||!$('mTime'))return null;const d0=dayStartMs(),t=d0+(+$('mTime').value)*Q;const key='p'+dayKey(t)+l.id+l.type+l.km;let c=cache[key];
  if(!c){const ll=S.latLng(l);try{c=cache[key]=FT.biteCtx({lat:ll[0],lng:ll[1],km:l.km,line:l.line,sys:FT.SYS,stype:l.type},d0,d0+864e5);}catch(e){c=cache[key]={slots:[]};}}
  const sl=c.slots[Math.floor((t-d0)/Q)];return sl?sl.score:null;}
function scoreAt(s,t){const d0=dayStartMs();const key='b'+dayKey(t)+s.line+s.km;let c=cache[key];
  if(!c){const ll=S.pointAt(s.km,s.line);try{c=cache[key]=FT.biteCtx({lat:ll[0],lng:ll[1],km:s.km,line:s.line,sys:FT.SYS},d0,d0+864e5);}catch(e){c=cache[key]={slots:[]};}}
  const sl=c.slots[Math.floor((t-d0)/Q)];return sl?sl.score:null;}
const TC={runin:'#2fd3a0',rising:'#5cc8ff',falling:'#f0a03a',slack:'#9db5b1',pool:'#6b6b6b',none:'#444'};
function colourSetup(){const v=pref.colour;const d0=dayStartMs();const r=$('mTime');
  if(r.dataset.day!==String(d0)){r.dataset.day=d0;r.value=Math.max(0,Math.min(95,Math.floor((Date.now()-d0)/Q)));}
  $('mTime').style.display=$('mTimeLbl').style.display=v==='off'?'none':'';colour();}
function colour(){if(!map)return;colG.clearLayers();const v=pref.colour;const d0=dayStartMs();const t=d0+(+$('mTime').value)*Q;
  $('mTimeLbl').textContent=v==='off'?'':'today '+fT(t)+(Math.abs(t-Date.now())<Q?' (now)':'');
  if(v==='off'){$('mLegend').innerHTML='';for(const [id,m] of markers){const l=S.get(id);if(l&&l.custom)m.setIcon(pinIcon(l,null));}creekG.eachLayer(l=>l.setStyle&&l.setStyle({opacity:l.options.color==='#5cc8ff'?.95:.75}));return;}
  creekG.eachLayer(l=>{if(l.options.color==='#5cc8ff')l.setStyle({opacity:.25});});
  if(myG)for(const [id,m] of markers){const l=S.get(id);if(l&&l.custom)m.setIcon(pinIcon(l,pinScore(l)));}
  for(const s of segs()){let c;if(v==='tide')c=TC[stageAt(s,t)];else{const sc=scoreAt(s,t);c=sc==null?'#444':scoreColor(sc);}
    LF.polyline(segLine(s),{color:'#0b1416',weight:9,opacity:.55,interactive:false}).addTo(colG);LF.polyline(segLine(s),{color:c,weight:6,opacity:1,interactive:false}).addTo(colG);}
  $('mLegend').innerHTML=v==='tide'?Object.entries({runin:'run-in start (0–2 h)',rising:'rising',falling:'falling',slack:'slack',pool:'pool level'}).map(([k,l])=>`<i style="background:${TC[k]}"></i>${l}`).join(''):
    `${FTRamp.legend()} <span>bite score (${GEN?esc(FT.SYSSHORT)+' tide model, '+(segs().length&&segs()[0].b-segs()[0].a>1.5?2:1):'Baffle model, 1'} km segments; numbers on typed pins = that spot’s own type-shaped score)</span>`;}
/* ---- lists ---- */
function migBanner(){const el=$('mMig');if(!el)return;const M=S.migration();if(!M){el.innerHTML='';return;}const tn=t=>t?S.TYPES[t].n:'general (no type)';
  el.innerHTML=`<div class="notice">🎨 <b>Spot colours are now spot types</b> (Run-in, Top of tide, Bottom of tide, Run-out). Your existing spots were converted from their colour — yellow → Run-in, pink → Run-out, anything else → general. Spots that were left on the old default yellow became Run-in, so please check them:
   <ul style="margin:4px 0 4px 18px;padding:0">${M.items.slice(0,40).map(x=>`<li>${esc(x.name)}${x.sys&&x.sys!==S.SYS?' <span class="mut">('+esc(x.sys)+')</span>':''}: <span style="color:${x.from||'#fff'}">●</span> ${esc(x.from||'—')} → <b>${tn(x.to)}</b></li>`).join('')}</ul>
   Tap a pin → ✏️ Edit → Spot type to change one. <button class="sm" id="mMigOk">Got it</button></div>`;
  $('mMigOk').onclick=()=>S.migrationSeen();}
function renderLists(){migBanner();const C=S.customs();$('mCount').textContent=C.length?`· ${C.length}`:'';
  $('mList').innerHTML=C.length?C.slice().sort((a,b)=>a.km-b.km).map(c=>`<div class="mitem"><span class="dot" style="background:${S.typeCol(c.type)||c.color||S.GENCOL}"></span><div class="ci"><b>${esc(c.name)}</b> ${typeTag(c)||'<span class="mut" style="font-size:.72rem">general</span>'} <span class="mut">km ${c.km.toFixed(1)} ${S.lineLabel(c.line,true)}${c.note?' · '+esc(c.note):''}</span></div><button class="sm" data-go="${c.id}">🗺</button><button class="sm" data-del="${c.id}">🗑</button></div>`).join('')
    :'<div class="cempty">No spots yet — long-press the map near the creek.</div>';
  $('mList').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const l=S.get(b.dataset.go);if(!map)return;map.setView([l.lat,l.lng],Math.max(map.getZoom(),15));setTimeout(()=>reopen(l.id),300);document.getElementById('mWrap').scrollIntoView({block:'start',behavior:'smooth'});});
  $('mList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const l=S.get(b.dataset.del);if(confirm(`Delete “${l.name}”?`))S.remove(l.id);});
  $('mBuiltins').innerHTML=S.builtins().map(l=>`<div class="mbi"><span>${esc(l.base)} <span class="mut">${l.km.toFixed(1)} km</span></span><input type="text" data-al="${l.id}" maxlength="60" placeholder="my name for it" value="${l.alias?esc(l.name):''}"></div>`).join('');
  $('mBuiltins').querySelectorAll('[data-al]').forEach(i=>i.onchange=()=>S.setAlias(i.dataset.al,i.value));}
/* ---- all river systems (thin lines; tap to switch) ---- */
async function drawSystems(){if(!FT.fetchSys||!sysG)return;let X;try{X=await FT.fetchSys('index');}catch(e){return;}
  const CC={A:'#57d18a',B:'#ffd38a',C:'#ff9b8a'};
  for(const s of X.systems){if(s.id===FT.SYS)continue;
    for(const ln of s.ov){const pl=LF.polyline(ln,{color:CC[s.conf]||'#ccc',weight:2.5,opacity:.55,dashArray:s.conf==='C'?'4 4':null}).addTo(sysG);
      pl.bindTooltip(esc(s.name)+' · '+s.conf,{sticky:true});
      pl.on('click',e=>{LF.popup({maxWidth:260}).setLatLng(e.latlng).setContent(`<div class="mpop"><h3>${esc(s.name)}</h3><div class="mut">${esc(s.area)} · confidence <b>${s.conf}</b> · ${s.km} km tidal · base ${esc(s.port)}${s.g?' · '+s.g+' gauge'+(s.g>1?'s':''):''}</div><div class="b"><button class="pri" data-sw="${s.id}">Switch to ${esc(s.name)}</button></div></div>`).openOn(map);
        setTimeout(()=>{const b=document.querySelector('[data-sw="'+s.id+'"]');if(b)b.onclick=()=>FT.switchSystem(s.id);},30);});}}}
/* ---- wiring ---- */
document.querySelectorAll('#mLayers button').forEach(b=>b.onclick=()=>{if(map)setLayer(b.dataset.l);else{pref.layer=b.dataset.l;savePref();}});
document.querySelectorAll('#mLayers button').forEach(b=>b.classList.toggle('on',b.dataset.l===pref.layer));
$('mAdd').onclick=()=>setAdd(!addMode);$('mMe').onclick=()=>{if(map)me();};
$('mColour').value=pref.colour;$('mColour').onchange=()=>{pref.colour=$('mColour').value;savePref();colourSetup();};
$('mTime').oninput=()=>colour();
$('mExport').onclick=()=>{const blob=new Blob([JSON.stringify(S.exportData(),null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='macs-jacks-spots.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);$('mIoMsg').textContent='Saved '+S.customs().length+' spot(s).';};
$('mImport').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const n=S.importData(JSON.parse(await f.text()));$('mIoMsg').textContent=`Restored ${n} spot(s).`;}catch(err){$('mIoMsg').textContent='Restore failed: '+err.message;}e.target.value='';};
S.onChange.push(()=>{renderLists();drawSpots();for(const k in cache)delete cache[k];if(pref.colour!=='off')colour();});
renderLists();
FT.onTab.push(t=>{if(t==='map'){init().then(()=>{if(map){map.invalidateSize();colourSetup();}});}else{stopMe();setAdd(false);}});
if(document.body.dataset.tab==='map')init();
FT.mapDebug={get map(){return map},get LF(){return LF},addAt,openSpot:id=>reopen(id),spotInfo};
})();
