/* ===== River-system UI: picker, GPS "nearest system", offline download, and wording for non-Baffle systems =====
   Runs after BT is ready and before the tab scripts. */
(function(){'use strict';
const FT=window.FT,B=window.BT,$=id=>document.getElementById(id),GEN=!!B.generic,I=FT.SYSINFO;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CONF={A:['A','calibrated with tide gauge(s)'],B:['B','partly calibrated (MSQ tide place / gauge near the mouth)'],C:['C','uncalibrated — generic model, wide ± (benchmark me)']};
FT.CONF=CONF;
/* ---- header picker ---- */
const hp=document.querySelector('header p');
const bar=document.createElement('div');bar.className='sysbar';
const areas=[];FT.SYSIDX.forEach(s=>{if(!areas.includes(s.area))areas.push(s.area);});
bar.innerHTML=`<label>📍 <select id="sysSel" aria-label="River system">${areas.map(a=>`<optgroup label="${esc(a)}">${FT.SYSIDX.filter(s=>s.area===a).map(s=>`<option value="${s.id}"${s.id===FT.SYS?' selected':''}>${esc(s.name)}${s.id==='baffle'?' ★':''} · ${s.conf}</option>`).join('')}</optgroup>`).join('')}</select></label>
 <span class="sysconf c${I.conf}" title="${esc(CONF[I.conf][1])}">${I.conf}</span><button class="sm" id="sysGps" title="Find the nearest river system to your GPS position">📡 Nearest</button><button class="sm" id="sysOff" title="Save every river system on this phone for offline use">⬇ Offline</button>
 <div id="sysMsg" class="sysmsg"></div>`;
hp.after(bar);
$('sysSel').onchange=()=>{const v=$('sysSel').value;if(v!==FT.SYS){$('sysMsg').innerHTML='<span class="spin"></span> Loading '+esc(FT.sysById(v).name)+'…';FT.switchSystem(v);}};
function msg(h,ms){$('sysMsg').innerHTML=h;clearTimeout(msg.t);if(ms)msg.t=setTimeout(()=>$('sysMsg').innerHTML='',ms);}
/* nearest system: distance to the simplified channel lines in data/systems/index.json */
let IDX=null;async function index(){if(!IDX)IDX=await FT.fetchSys('index');return IDX;}
function distToLine(lat,lon,ln){const kx=111.32*Math.cos(lat*Math.PI/180),ky=110.54;let d=1e9;
  for(let i=0;i<ln.length-1;i++){const ax=(ln[i][1]-lon)*kx,ay=(ln[i][0]-lat)*ky,bx=(ln[i+1][1]-lon)*kx,by=(ln[i+1][0]-lat)*ky;const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));d=Math.min(d,Math.hypot(ax+t*dx,ay+t*dy));}
  if(ln.length===1)d=Math.hypot((ln[0][1]-lon)*kx,(ln[0][0]-lat)*ky);return d;}
FT.nearestSystems=async function(lat,lon){const X=await index();return X.systems.map(s=>({s,d:Math.min(...s.ov.map(l=>distToLine(lat,lon,l)))})).sort((a,b)=>a.d-b.d);};
function offer(lat,lon,N,why){const b=N[0];
  if(!b||b.d>3){msg(`${why||'You'} are ${b?b.d.toFixed(1)+' km from the nearest mapped tidal channel ('+esc(b.s.name)+')':'not near a mapped system'} — staying on ${esc(FT.SYSNAME)}.`,8000);return;}
  if(b.s.id===FT.SYS){msg(`✅ You're on <b>${esc(FT.SYSNAME)}</b> (${Math.round(b.d*1000)} m from the channel).`,6000);return;}
  msg(`📍 ${why||'You'}’re ${Math.round(b.d*1000)} m from <b>${esc(b.s.name)}</b> (${b.s.conf}). <button class="sm pri" id="sysGo">Switch</button>${N[1]&&N[1].d<2&&N[1].s.id!==FT.SYS?` <button class="sm" id="sysGo2">${esc(N[1].s.name)}</button>`:''}`);
  $('sysGo').onclick=()=>FT.switchSystem(b.s.id);if($('sysGo2'))$('sysGo2').onclick=()=>FT.switchSystem(N[1].s.id);}
$('sysGps').onclick=()=>{if(!navigator.geolocation){msg('No GPS on this device.',4000);return;}msg('<span class="spin"></span> Getting GPS…');
  navigator.geolocation.getCurrentPosition(async p=>{try{offer(p.coords.latitude,p.coords.longitude,await FT.nearestSystems(p.coords.latitude,p.coords.longitude));}catch(e){msg('Couldn’t load the systems index ('+esc(e.message)+') — connect once.',6000);}},
    e=>msg('GPS failed: '+esc(e.message),5000),{enableHighAccuracy:true,timeout:20000,maximumAge:60000});};
/* used by the Tides/Map GPS buttons when a fix is far from this system's channels */
FT.suggestSystem=async function(lat,lon){try{const N=await FT.nearestSystems(lat,lon);if(N[0]&&N[0].s.id!==FT.SYS&&N[0].d<2){offer(lat,lon,N,'Your GPS fix');window.scrollTo(0,0);}}catch(e){}};
$('sysOff').onclick=async()=>{const st=await FT.sysOffline();
  if(!confirm(`Save all ${st.of} river systems (~0.9 MB) on this phone for offline use?\n(${st.n} already saved. Systems you open are saved automatically. Map tiles are separate.)`))return;
  $('sysOff').disabled=true;const r=await FT.downloadAllSystems((i,n)=>msg(`<span class="spin"></span> Saving ${i}/${n}…`));$('sysOff').disabled=false;
  msg(r.bad?`⚠ Saved ${r.ok}; ${r.bad} failed (offline?). Try again later.`:`✅ All ${r.ok} systems saved for offline use.`,8000);};
FT.sysOffline().then(st=>{if(st.n>=st.of)$('sysOff').textContent='✅ Offline';}).catch(()=>{});
/* default bite-times spot for this system */
FT.defaultSpot=function(){if(!GEN){const km=15.9,p=B.pointAtKm(km);return{name:'Wartburg (Boat Ramp Rd) — Baffle Ck',lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:km,sys:'baffle'};}
  const l=B.LANDMARKS.find(x=>x.line==='M'&&Math.abs(x.km-B.DEFKM)<0.01)||{name:'km '+B.DEFKM.toFixed(1),km:B.DEFKM,line:'M'};const p=B.pointOnLine(l.km,'M');
  return{name:l.name+' — '+FT.SYSSHORT,lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:+l.km.toFixed(2),baffleLine:'M',sys:FT.SYS};};
if(!GEN)return;
/* ---------------- wording & cards for non-Baffle systems ---------------- */
const S=B.SYS,port=S.port.name;
document.title=`Mac's Jacks — ${FT.SYSNAME} tides & mangrove jack bite times`;
hp.textContent=`Mangrove jack bite times · ${FT.SYSNAME} tides (mouth → ${B.lineMax('M').toFixed(0)} km) · ${S.area}`;
const bs=$('mj-bafSel');if(bs&&bs.parentNode&&bs.parentNode.firstChild&&bs.parentNode.firstChild.nodeType===3)bs.parentNode.firstChild.textContent=FT.SYSNAME+' spot ';
/* Tides tab */
const tab=$('tab-baffle');
const n0=tab.querySelector('.notice');if(n0)n0.innerHTML=`⚠️ <b>Not for navigation.</b> Estimates only, from a model of ${esc(FT.SYSNAME)} built from MSQ tide data, BoM gauges and map data — confidence <b>${I.conf}</b> (${esc(CONF[I.conf][1])}). Use official <a href="https://www.msq.qld.gov.au/tides/tide-tables.aspx" target="_blank" rel="noopener">MSQ Queensland Tide Tables</a> for anything that matters, and watch the water.`;
const h2=tab.querySelector('section.card h2');if(h2)h2.textContent='📍 Spot on '+FT.SYSNAME;
if(B.LINES.length>1){const ls=document.createElement('select');ls.id='bt-line';ls.setAttribute('aria-label','Channel');$('bt-lm').after(ls);}
const kl=$('bt-kmLbl');if(kl&&kl.nextElementSibling)kl.nextElementSibling.id='bt-kmMaxLbl';
const ho=$('bt-hoff');if(ho&&ho.parentNode)ho.parentNode.title=`Adds to all predicted heights (storm surge / wind setup at ${port})`;
const ba=$('bt-badj');if(ba&&ba.parentNode){ba.parentNode.title='Raise/lower the drained-out low-water level in the upper reach (freshwater flow). Default 0.';ba.parentNode.firstChild.textContent='Upper-reach base adj (m) ';}
const lg=$('bt-chart')&&$('bt-chart').nextElementSibling;if(lg)lg.innerHTML=`<span><b style="color:var(--acc)">━</b> Selected spot</span><span><b style="color:var(--tide)">━</b> Mouth (≈ ${esc(S.nodes.M[0].name.replace(/^Mouth \((≈ )?/,'').replace(/\)$/,''))})</span><span><b style="color:#ff7b6b">┅</b> ${esc(B.REFNAME)} (${B.REFKM.toFixed(1)} km)</span><span>Heights m AHD (≈ mean sea level). Shaded band = timing uncertainty.</span>`;
const st=tab.querySelector('#bt-stretch');if(st){const p=st.closest('section').querySelector('p');if(p)p.innerHTML+=' Landmarks: OSM boat ramps &amp; road bridges, junctions, gauges.';}
/* gauges card */
const lv=$('bt-live');if(lv){const card=lv.closest('section');const G=(S.gauges||[]).filter(g=>!g.coastal),C=(S.gauges||[]).filter(g=>g.coastal);
  const a=g=>`<a href="https://www.bom.gov.au/fwo/${g.tab}/${g.tab}.${g.id}.tbl.shtml" target="_blank" rel="noopener">${esc(g.name)} ${g.id}</a> (<a href="https://www.bom.gov.au/fwo/${g.tab}/${g.tab}.${g.id}.plt.shtml" target="_blank" rel="noopener">plot</a>)`;
  card.innerHTML=`<h2>📡 Live gauges</h2><p class="mut">${G.length?'Tidal water-level gauges on this system (BoM, opens their page): '+G.map(g=>a(g)+(g.km!=null?` <span class="mut">km ${g.km.toFixed(1)}${g.line!=='M'?' '+esc(g.lineName):''}</span>`:'')).join(' · '):'No BoM tide-affected gauge on this system.'}${C.length?'<br>Coastal tide gauges nearby: '+C.map(a).join(' · '):''}<br>See the 📡 Gauges tab for gauge-vs-model comparisons.</p>`;}
/* how-predictions card */
const nt=$('bt-nodesTbl');if(nt){const card=nt.closest('section');const lim=S.lines.map(l=>`<li><b>${esc(l.name)}</b>${l.id==='M'?'':!l.parent?' (own entrance)':' (joins at km '+l.junctionKm.toFixed(1)+')'}: modelled to km ${(l.junctionKm+l.limitKm).toFixed(1)} — ${esc(l.limitSrc)}</li>`).join('');
  card.innerHTML=`<h2>🧪 How predictions are made — ${esc(FT.SYSNAME)}</h2>
  <p><span class="sysconf c${I.conf}">${I.conf}</span> <b>${esc(S.confidence.why)}</b></p>
  <details open><summary>1 · Base tide: ${esc(port)} harmonic model</summary><p>41 tidal constituents with nodal corrections, least-squares fitted offline to the MSQ official 2026 10-minute predictions for ${esc(port)} (data.qld.gov.au). Runs offline for any date. Same method as the Baffle Creek model (Bundaberg), which validates to ≈5 min against official MSQ times.</p></details>
  <details><summary>2 · Along-channel transfer (calibration nodes)</summary><div id="bt-nodesTbl"></div>
   <p>Each ${esc(port)} high/low is shifted in time and mapped in height using the values at your spot, interpolated linearly by channel distance between nodes; the curve between turns is the standard cosine interpolation. Node types: <b>gauge</b> = BoM water-level gauge (7–14 days of readings matched to the base port) or an MSQ tide gauge's official predictions; <b>MSQ</b> = MSQ secondary place (published time/height offsets); <b>generic</b> = extrapolated with the median lag growth of all calibrated QLD places/gauges (≈2 min/km highs, ≈2.7 min/km lows) and wide ±. Tributaries share the main-channel model up to their junction. Heights are m AHD (≈ local mean sea level).</p></details>
  <details><summary>3 · Tidal limits</summary><ul>${lim}</ul><p class="mut">Estimated from OSM weirs/barrages, a 90 m elevation model (river bed rising above ~4 m), and gauge evidence. Above a natural limit the creek drains out at low tide: lows are a “pool level” and run-in starts are when the water starts rising.</p></details>
  <details><summary>4 · Limitations — please benchmark</summary><ul><li>Upstream BoM gauge fits use only the last 1–2 weeks of readings; flood/fresh flows delay and flatten tides and raise levels.</li><li>MSQ ** places are “non-linear transfer” estimates, and some gauge datums are unknown (heights then interpolated).</li><li>Generic reaches can be out by an hour or more. Log a few high/low turns in the Benchmark log — tick <b>apply</b> to correct this system (stored per system on this phone).</li><li>Wind, pressure and swell shift real levels by 0.1–0.3 m.</li></ul></details>
  <p class="mut">Sources: ${S.sources.map(esc).join(' · ')}. Model built ${esc(S.built)}.</p>`;}
const nl=tab.querySelectorAll(':scope > .notice');const last=nl[nl.length-1];if(last&&/bar and shallows/.test(last.innerHTML))last.innerHTML=last.innerHTML.replace('Baffle Creek’s bar',esc(FT.SYSNAME)+'’s bar');
})();
/* ===== two-entrance passages: "Fed from" note + km both ways ===== */
(function(){const FT=window.FT,B=window.BT;if(!B||!B.fedFrom)return;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NM=B.TWONM;
FT.fedInfo=function(km,line){const f=B.fedFrom(km,line||'M');if(!f)return null;const N=f.nm||NM;const c=B.calAt(km,{line:line||'M'});const n=Math.round(f.n*100),s=100-n;
  let g=c.est?(f.side?'C':'B'):'A';if(N.gradeCap&&g<N.gradeCap)g=N.gradeCap;return{n,s,g,est:!!c.est,side:f.side,x:f.x,node:f.node,nm:N,dom:n>=60?N.nWord+' ('+N.nName+')':s>=60?N.sWord+' ('+N.sName+')':'both ends (tidal node)'};};
FT.twoNote=function(km,line){const i=FT.fedInfo(km,line);if(!i)return '';
  return `<div class="fed" data-fed="${i.n}">🌊 <b>Fed from:</b> ${esc(i.nm.nWord)} ${i.n}% / ${esc(i.nm.sWord)} ${i.s}% — ${esc(i.dom)}${i.side?' (via the creek junction at passage km '+i.x.toFixed(1)+')':''} · accuracy <span class="sysconf c${i.g}">${i.g}</span>${i.est?' <b>est.</b>':''}${Math.abs(i.x-i.node)<(i.nm.near||3)?' · near the tidal node: small range, flattened/late highs':''}</div>`;};
})();
