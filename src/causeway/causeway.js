/* ===== Causeway flow (systems with S.causeway, e.g. Moneys Creek, Bargara) =====
   Water runs IN through the causeway gates/pipes while the predicted sea-side level is above the lagoon level (threshold),
   OUT while it is below, slack near it. Threshold comes from the system data (estimate) and can be overridden on this phone
   (localStorage mbj_cw, keyed by system; private, never shared). Tides graph: green = running in, orange = running out,
   grey = slack, dashed line = threshold; list = next 7 days with head (strength) and rate of rise. */
(function(){'use strict';
const FT=window.FT,B=window.BT;if(!B||!B.generic||!B.SYS||!B.SYS.causeway)return;
const C=B.SYS.causeway,SYS=FT.SYS,KC='mbj_cw',SLACK=0.04;
const E0=Date.UTC(2025,11,31,14),TZ='Australia/Brisbane';const hToMs=h=>E0+h*36e5,msToH=ms=>(ms-E0)/36e5;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fT=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace(' am','am').replace(' pm','pm');
const fD=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short',day:'numeric',month:'short'}).format(new Date(ms));
const dayK=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(ms));
const load=()=>{try{return JSON.parse(localStorage.getItem(KC))||{};}catch(e){return {};}};
const hooks=[];
function thr(){const v=load()[SYS];return v!=null&&isFinite(+v)?+v:C.thr;}
function custom(){return load()[SYS]!=null;}
function setThr(v){const o=load();if(v==null||v===''||!isFinite(+v))delete o[SYS];else o[SYS]=Math.max(-2,Math.min(4,+(+v).toFixed(2)));try{localStorage.setItem(KC,JSON.stringify(o));}catch(e){}cache.clear();hooks.forEach(f=>{try{f()}catch(e){}});}
function opts(){const o=Object.assign({},FT.baffleOpts?FT.baffleOpts():{});o.line=C.line||'M';return o;}
const cache=new Map();
/* phases over [h0,h1] (hours): {k:'in'|'out'|'slack',a,b,peak head,max rise m/h} */
function phases(h0,h1){const th=thr(),a=Math.floor(h0),b=Math.ceil(h1),key=[th,a,b].join('|');if(cache.has(key))return cache.get(key);
  const P=B.predictAt(C.km,a-3,b+3,opts()),st=1/12,W=[];let cur=null;
  for(let h=a;h<=b+1e-9;h+=st){const v=P.curve(h),v2=P.curve(h+st);if(v==null)continue;const d=v-th,k=d>SLACK?'in':d<-SLACK?'out':'slack',r=v2==null?0:(v2-v)/st;
    if(!cur||cur.k!==k){if(cur){cur.b=h;W.push(cur);}cur={k,a:h,head:0,rise:0,top:v};}
    if(Math.abs(d)>cur.head)cur.head=Math.abs(d);if(Math.abs(r)>Math.abs(cur.rise))cur.rise=r;if(v>cur.top)cur.top=v;}
  if(cur){cur.b=b;W.push(cur);}
  W.forEach(w=>{w.ta=hToMs(w.a);w.tb=hToMs(w.b);});if(cache.size>100)cache.clear();cache.set(key,W);return W;}
const strength=hd=>hd<0.1?'weak':hd<0.35?'moderate':'strong';
const vel=hd=>0.6*Math.sqrt(2*9.81*Math.max(0,hd));   // orifice-flow estimate through the pipes, m/s
function gatesOn(ms){const G=C.gates;if(!G)return false;const d=dayK(ms);if(+d.slice(0,4)!==G.year)return null;const md=d.slice(5);return G.open.some(([a,b])=>md>=a&&md<=b);}
function now(){const h=msToH(Date.now());const W=phases(h-6,h+30);const w=W.find(x=>x.a<=h&&x.b>h);const P=B.predictAt(C.km,h-1,h+1,opts());const v=P.curve(h),r=(P.curve(h+0.1)-P.curve(h-0.1))/0.2;
  const nx=W.find(x=>x.a>h&&x.k!=='slack'&&(!w||x.k!==w.k));return{w,v,r,nx,th:thr()};}
const COL={in:'#3ddc84',out:'#ff9a3d',slack:'#9aa7ad'},WORD={in:'running in',out:'running out',slack:'slack'};
function nowLine(){const n=now();if(!n.w)return '';const k=n.w.k;
  return `<b style="color:${COL[k]}">${k==='in'?'⬆ Running in':k==='out'?'⬇ Running out':'≈ Slack'}</b> now · level ${n.v.toFixed(2)} m vs ${n.th.toFixed(2)} m · ${n.r>=0?'rising':'falling'} ${Math.abs(n.r*100).toFixed(0)} cm/h${k!=='slack'?` · ${strength(Math.abs(n.v-n.th))} (~${vel(Math.abs(n.v-n.th)).toFixed(1)} m/s in the pipes)`:''}${n.nx?` · ${WORD[n.nx.k]} from ${fT(n.nx.ta)}`:''}`;}
const API={thr,setThr,custom,phases,now,nowLine,hooks,C,gatesOn};FT.causeway=API;
const near=km=>Math.abs(km-C.km)<0.6;
API.tideRange=km=>near(km)?{lo:thr(),hi:thr()}:null;
API.tideSvg=function(g){if(!near(g.km))return '';let s='';const th=thr();
  for(const w of phases(g.t0-1,g.t1+1)){const a=Math.max(g.t0,w.a),b=Math.min(g.t1,w.b);if(b<=a)continue;const wd=g.x(b)-g.x(a);
    s+=`<rect class="cwshade cw-${w.k}" x="${g.x(a).toFixed(1)}" y="${g.T}" width="${wd.toFixed(1)}" height="${g.ph}" fill="${COL[w.k]}" opacity="${w.k==='slack'?.22:.14}"/>`;
    if(w.k!=='slack'&&wd>34)s+=`<text x="${((g.x(a)+g.x(b))/2).toFixed(1)}" y="${g.T+12}" fill="${COL[w.k]}" font-size="10" text-anchor="middle">${w.k==='in'?'⬆ in':'⬇ out'}</text>`;}
  if(th>=g.mn&&th<=g.mx)s+=`<line class="cwthr" x1="${g.L}" x2="${g.W-g.R}" y1="${g.y(th).toFixed(1)}" y2="${g.y(th).toFixed(1)}" stroke="#7fd7ff" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${g.W-g.R-4}" y="${(g.y(th)-4).toFixed(1)}" fill="#7fd7ff" font-size="11" text-anchor="end">causeway flow line ${th.toFixed(2)} m${custom()?'':' (est.)'}</text>`;
  return s;};
API.tideList=function(km,o,t0){const ch=document.getElementById('bt-chart');if(!ch)return;let box=document.getElementById('cwTides');
  if(!box){box=document.createElement('div');box.id='cwTides';box.className='cwbox';const x=document.getElementById('xTides');const lg=ch.nextElementSibling;(x||lg||ch).after(box);}
  if(!near(km)){box.innerHTML=`<p class="mut">🌊 Causeway flow: pick <b>${esc(C.name)}</b> (km ${C.km.toFixed(2)}) to see when it runs in and out.</p>`;return;}
  const h0=Math.max(t0,Math.floor(msToH(Date.now()))),h1=h0+24*7,th=thr();
  const W=phases(h0,h1).filter(w=>w.k!=='slack'&&w.tb>Date.now()&&w.b-w.a>=0.25);const by={};W.forEach(w=>{const k=dayK(w.ta);(by[k]=by[k]||[]).push(w);});
  const rows=Object.keys(by).map(k=>{const g=gatesOn(by[k][0].ta);return `<tr><td>${fD(by[k][0].ta)}${g?' <span class="cwg">gates</span>':''}</td><td>${by[k].map(w=>`<span style="color:${COL[w.k]}">${w.k==='in'?'⬆':'⬇'} ${fT(w.ta)}–${fT(w.tb)}</span> <span class="mut">${strength(w.head)}${w.k==='in'?', peak +'+w.head.toFixed(2)+' m, rise '+Math.round(Math.abs(w.rise)*100)+' cm/h':', −'+w.head.toFixed(2)+' m'}</span>`).join('<br>')}</td></tr>`;}).join('');
  box.innerHTML=`<h3 style="margin:10px 0 4px">🌊 ${esc(C.name)} — run in / out</h3><div>${nowLine()}</div>
   <div class="mut" style="font-size:.8rem;margin:4px 0"><span style="color:${COL.in}">■</span> running in (sea side above the flow line) · <span style="color:${COL.out}">■</span> running out · <span style="color:${COL.slack}">■</span> slack (±${Math.round(SLACK*100)} cm)</div>
   <div class="tw"><table class="xtbl">${rows||'<tr><td class="mut">No flow windows in the next 7 days.</td></tr>'}</table></div>
   <label class="mut">Flow line (lagoon level) <input id="cwThr" type="number" step="0.05" min="-2" max="4" value="${th.toFixed(2)}" style="width:5em"> m</label> <button class="sm" id="cwHere">It's slack right now</button> ${custom()?'<button class="sm" id="cwReset">Reset to estimate</button>':''}
   <p class="mut" style="font-size:.78rem;margin:4px 0 0">${custom()?'Your height (this phone only).':'Estimated '+C.thr.toFixed(2)+' m: '+esc(C.thrSrc)+'.'} Heights ≈ m AHD at the causeway, sea side (lows held at ${C.basin.toFixed(2)} m by the beach bar). The road itself (~${C.road.toFixed(1)} m) only goes under in a big storm tide. Flow needs the gates/pipes open: council opens the gates ~monthly on big tides${C.gates?' (days marked “gates”, '+esc(C.gates.src)+')':''}. Strength = level difference; speed is a rough pipe estimate. ⚠ Strong suction at the pipes — keep clear.</p>`;
  const i=box.querySelector('#cwThr');i.onchange=()=>setThr(i.value);
  box.querySelector('#cwHere').onclick=()=>{const n=now();if(n.v!=null)setThr(n.v);};
  const r=box.querySelector('#cwReset');if(r)r.onclick=()=>setThr(null);};
/* map marker */
let LF=null,map=null,grp=null;
API.drawMap=function(lf,mp){LF=lf;map=mp;if(!grp)grp=LF.layerGroup().addTo(map);grp.clearLayers();
  const m=LF.marker([C.lat,C.lng],{icon:LF.divIcon({className:'mpin-wrap',html:'<div class="mcw">⛩</div>',iconSize:[24,24],iconAnchor:[12,12]}),title:C.name,zIndexOffset:550}).addTo(grp);
  m.bindTooltip(esc(C.name),{direction:'top',offset:[0,-12]});
  m.on('click',()=>{const p=LF.popup({maxWidth:270}).setLatLng([C.lat,C.lng]).setContent(`<div class="mpop"><h3>⛩ ${esc(C.name)}</h3><div>${nowLine()}</div><div class="mut" style="margin-top:4px">Flow line ${thr().toFixed(2)} m${custom()?' (yours)':' (est.)'} · road ~${C.road.toFixed(1)} m AHD<br>${esc(C.locSrc)}</div><div class="b"><button class="pri" data-c="t">📈 Tides here</button></div></div>`).openOn(map);
    p.getElement().querySelector('[data-c=t]').onclick=()=>{map.closePopup();FT.baffleSelect&&FT.baffleSelect(C.km,null,C.line);FT.showTab&&FT.showTab('baffle');};});
  const lg=document.querySelector('.mtleg');if(lg&&!lg.querySelector('.cwleg'))lg.insertAdjacentHTML('beforeend','<span class="cwleg"><b class="mcw sm">⛩</b>Causeway</span>');};
hooks.push(()=>{if(map)API.drawMap(LF,map);});
hooks.push(()=>{if(FT.spots&&FT.spots.onChange)FT.spots.onChange.forEach(f=>{try{f()}catch(e){}});});
})();
