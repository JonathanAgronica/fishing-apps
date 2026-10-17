/* ===================== Gauges tab — "Spots" overlay (every system) =====================
   Lets the user pick their own spots (★, from mbj_spots), built-in / renamed landmarks or any km, and draws each spot's
   PREDICTED tide (same along-creek model + applied benchmarks as the Tides tab; truncated "resting" lows and run-in starts
   included) on the gauge chart, extending ~1.5–2 days past now for planning. Selections are remembered per system
   (localStorage FT.k('mbj_gspots')); spots never leave this phone — everything here is computed locally. */
(function(){
'use strict';
const FT=window.FT,BT=window.BT,SP=FT.spots,$=id=>document.getElementById(id);if(!BT||!SP)return;
const GEN=!!BT.generic;
const KEY=FT.k('mbj_gspots'),KEYB=FT.k('mbj_gspots_band'),MAXSEL=6;
const E0=Date.UTC(2025,11,31,14),nowM=()=>(Date.now()-E0)/60000;
const fT=(m,o)=>new Intl.DateTimeFormat('en-AU',Object.assign({timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',hour12:true},o||{})).format(new Date(E0+m*60000)).replace(' am','am').replace(' pm','pm');
const fDT=m=>fT(m,{weekday:'short',day:'numeric',month:'short'});
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm=min=>{const s=min<0?'−':'+';min=Math.abs(min);return s+Math.floor(min/60)+':'+String(Math.round(min%60)).padStart(2,'0');};
const PAL=['#ffd166','#06d6a0','#c77dff','#4cc9f0','#ff70a6','#e9ff70','#f4a261','#ffffff'];
const load=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}};
let sel=load(KEY,[]);if(!Array.isArray(sel))sel=[];let band=!!load(KEYB,false);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(sel));localStorage.setItem(KEYB,JSON.stringify(band));}catch(e){}};
const lineOf=l=>GEN?(l.line||'M'):(l.line||'B');
const lineTxt=(line)=>GEN&&line&&line!=='M'?' '+SP.lineLabel(line,true):(!GEN&&line&&line!=='B'?' '+SP.lineLabel(line,true):'');
/* resolve the saved selection to spots (deleted spots drop out) + colours */
function list(){const used=new Set(),out=[];
  for(const s of sel){let r=null;
    if(s.id){const l=SP.get(s.id);if(!l)continue;r={key:s.id,name:l.name,km:l.km,line:lineOf(l),custom:!!l.custom,builtin:!!l.builtin,color:l.color,type:l.type||''};}
    else if(isFinite(s.km)){r={key:'km:'+(s.line||'')+':'+s.km,name:(SP.alongLabel&&SP.alongLabel(+s.km,s.line))||('km '+(+s.km).toFixed(2)+lineTxt(s.line)),km:+s.km,line:s.line||(GEN?'M':'B'),adhoc:true};}
    if(!r)continue;out.push(r);}
  /* own colour if it is clearly different from the colours already taken, else the palette colour furthest from them */
  const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),dist=(a,b)=>{const x=rgb(a),y=rgb(b),rm=(x[0]+y[0])/2;return Math.sqrt((2+rm/256)*(x[0]-y[0])**2+4*(x[1]-y[1])**2+(2+(255-rm)/256)*(x[2]-y[2])**2);};
  const far=c=>[...used].reduce((m,u)=>Math.min(m,dist(c,u)),1e9);
  for(const r of out)if(r.custom&&/^#[0-9a-f]{6}$/i.test(r.color||'')&&far(r.color)>150){r.col=r.color;used.add(r.color);}
  for(const r of out)if(!r.col){let best=PAL[0],bd=-1;for(const c of PAL){const d=far(c);if(d>bd){bd=d;best=c;}}r.col=best;used.add(best);}
  return out;}
function opts(r){return Object.assign({},FT.baffleOpts?FT.baffleOpts():{},GEN||r.line?{line:r.line}:{});}
const cache=new Map();
/* predictions for one spot over model hours [h0,h1] */
function pred(r,h0,h1){const o=opts(r);const key=r.key+'|'+r.km+'|'+h0+'|'+h1+'|'+JSON.stringify(o);let c=cache.get(key);if(c)return c;
  if(cache.size>60)cache.clear();
  const P=BT.predictAt(r.km,h0,h1,o);let R=[];try{R=BT.runInStarts?BT.runInStarts(r.km,h0,h1,o):[];}catch(e){}
  const trunc=!!(P.cal&&P.cal.trunc);
  c={P,R,trunc,cal:P.cal};cache.set(key,c);return c;}
/* chart layer for the visible window (minutes since 2026-01-01 AEST) */
function prepare(v0,v1){const L=list();if(!L.length)return[];
  const h0=Math.floor(v0/60/6)*6-14,h1=Math.ceil(v1/60/6)*6+14,span=h1-h0;if(span>24*60)return L.map(r=>Object.assign(r,{pts:[],ext:[],R:[],tooWide:true}));
  const st=Math.max(1/12,span/1400);
  return L.map(r=>{const c=pred(r,h0,h1);const pts=[];for(let h=h0;h<=h1;h+=st){const v=c.P.curve(h);if(v!=null)pts.push([h*60,v]);}
    const ext=c.P.ext.map(e=>({t:e.t*60,h:e.h,hi:e.hi,u:e.u,weak:!!e.weak,stand:!!e.stand,s0:e.stand?e.standT0*60:null,s1:e.stand?e.standT1*60:null,bt:e.src?e.src.t*60:null}));
    const R=c.R.map(x=>({t:x.t*60,u:x.u,kind:x.kind,v:c.P.curve(x.t)}));
    return Object.assign(r,{pts,ext,R,P:c.P,trunc:c.trunc,cal:c.cal});});}
function uAt(ext,m){let best=null,bd=1e9;for(const e of ext){const d=Math.abs(e.t-m);if(d<bd){bd=d;best=e;}}return best?best.u:30;}
/* SVG for the main panel (call inside the clip group) */
function svgMain(layer,X,Y1,v0,v1){let o='';
  for(const r of layer){if(!r.pts.length)continue;const a=r.pts.filter(p=>p[0]>=v0-240&&p[0]<=v1+240);if(!a.length)continue;
    if(band){const up=[],dn=[];for(const p of a){const u=uAt(r.ext,p[0]);const vs=[p[1],r.P.curve((p[0]-u)/60),r.P.curve((p[0]+u)/60)].filter(v=>v!=null);up.push([p[0],Math.max(...vs)]);dn.push([p[0],Math.min(...vs)]);}
      o+=`<path d="M${up.map(p=>X(p[0]).toFixed(1)+','+Y1(p[1]).toFixed(1)).join('L')}L${dn.reverse().map(p=>X(p[0]).toFixed(1)+','+Y1(p[1]).toFixed(1)).join('L')}Z" fill="${r.col}" opacity=".13" stroke="none"/>`;}
    let d='',prev=null;for(const p of a){d+=(!prev||p[0]-prev[0]>240?'M':'L')+X(p[0]).toFixed(1)+','+Y1(p[1]).toFixed(1);prev=p;}
    o+=`<path d="${d}" fill="none" stroke="${r.col}" stroke-width="1.8" stroke-dasharray="6 3" opacity=".95"/>`;
    for(const e of r.ext){if(e.t<v0||e.t>v1)continue;const x=X(e.t),y=Y1(e.h);
      if(e.stand){const sv=r.P.curve(e.t/60);if(sv!=null){const ys=Y1(sv);o+=`<rect x="${X(e.s0).toFixed(1)}" y="${(ys-2.5).toFixed(1)}" width="${Math.max(2,X(e.s1)-X(e.s0)).toFixed(1)}" height="5" rx="2.5" fill="${r.col}" opacity=".35"><title>${esc(r.name)}: tide stand (single-high day — small high doesn’t reach here)</title></rect><text x="${x.toFixed(1)}" y="${(ys-7).toFixed(1)}" fill="${r.col}" font-size="10" text-anchor="middle" opacity=".85">stand</text>`;}}
      else if(e.hi)o+=e.weak?`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="none" stroke="${r.col}" opacity=".6"/>`:`<path d="M${x.toFixed(1)},${(y-11).toFixed(1)}l-4.5,7h9z" fill="#0f2427" stroke="${r.col}" stroke-width="1.4"/>`;
      else if(r.trunc)o+=`<rect x="${(x-5).toFixed(1)}" y="${(y+4).toFixed(1)}" width="10" height="3" fill="${r.col}" opacity=".85"/>`;
      else o+=`<path d="M${x.toFixed(1)},${(y+11).toFixed(1)}l-4.5,-7h9z" fill="#0f2427" stroke="${r.col}" stroke-width="1.4"/>`;}
    for(const s of r.R){if(s.t<v0||s.t>v1||s.v==null)continue;const x=X(s.t),y=Y1(s.v);o+=`<path d="M${(x-3).toFixed(1)},${(y-6).toFixed(1)}l9,6l-9,6z" fill="${r.col}" stroke="#0f2427" stroke-width=".8"/>`;}}
  return o;}
/* predicted HW/LW lags (minutes after the base-port PREDICTION) for the lag panel — hollow markers */
function lagPts(layer,v0,v1){const out=[];for(const r of layer)for(const e of r.ext){if(e.bt==null||e.bt<v0-600||e.bt>v1||(e.hi&&e.weak))continue;
  out.push({bt:e.bt,lag:Math.round(e.t-e.bt),u:e.u,col:r.col,hi:e.hi,r});}return out;}
function lagSvg(pts,X,Y2){return pts.map(p=>{const x=X(p.bt).toFixed(1);return `<line x1="${x}" x2="${x}" y1="${Y2(p.lag-p.u)}" y2="${Y2(p.lag+p.u)}" stroke="${p.col}" stroke-width="1" stroke-dasharray="2 2" opacity=".75"/>`+
  (p.hi?`<circle cx="${x}" cy="${Y2(p.lag)}" r="3.6" fill="#0f2427" stroke="${p.col}" stroke-width="1.6"/>`:`<rect x="${(+x-3.4).toFixed(1)}" y="${(Y2(p.lag)-3.4).toFixed(1)}" width="6.8" height="6.8" fill="#0f2427" stroke="${p.col}" stroke-width="1.6"/>`);}).join('');}
function lagLegend(layer){const o=[];for(const r of layer){o.push({col:r.col,lab:r.name+' HW (pred)',hollow:'c'});o.push({col:r.col,lab:r.name+(r.trunc?' rest/LW (pred)':' LW (pred)'),hollow:'s'});}return o;}
/* tap read-out */
function tipRows(layer,m,tol){const rs=[];for(const r of layer){if(!r.P)continue;const v=r.P.curve(m/60);let ev=null,bd=tol;
  for(const e of r.ext){const d=Math.abs(e.t-m);if(d<=bd&&!(e.hi&&e.weak)){bd=d;ev=e;}}
  const sd=r.ext.find(e=>e.stand&&m>=e.s0-30&&m<=e.s1+30);
  let ri=null;for(const s of r.R){const d=Math.abs(s.t-m);if(d<=bd){bd=d;ri=s;ev=null;}}
  let t=`<span style="color:${r.col}">◇</span> ${esc(r.name)} <span class="mut">pred</span>: <b>${v!=null?v.toFixed(2):'—'}</b> <span class="mut">±${Math.round(uAt(r.ext,m))}′</span>`;
  if(ev)t+=`<br>&nbsp;&nbsp;${ev.hi?'▲ HW':r.trunc?'▬ resting low':'▼ LW'} ${fT(ev.t)} <span class="mut">±${Math.round(ev.u)}′</span> · ${ev.h.toFixed(2)} m`;
  if(sd&&!ev&&!ri)t+=`<br>&nbsp;&nbsp;🌗 tide stand ${fT(sd.s0)}–${fT(sd.s1)} <span class="mut">slack, no rise (single-high day)</span>`;
  if(ri)t+=`<br>&nbsp;&nbsp;▶ run-in starts ${fT(ri.t)} <span class="mut">±${Math.round(ri.u)}′</span>${ri.v!=null?' · '+ri.v.toFixed(2)+' m':''}`;
  rs.push(t);}return rs;}
/* "predicted now" cards for the latest-readings grid */
const TY=(SP&&SP.TYPES)||{};
/* 🎣 Bite times from a spot card (delegated: cards are re-rendered every refresh) */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-gbite]');if(!b||!FT.biteSetLoc)return;const k=b.dataset.gbite;const r=list().find(x=>x.key===k);if(!r)return;
  const p=SP.pointAt(r.km,r.line);const nm=(r.adhoc?r.name:r.name)+' — '+(GEN?FT.SYSSHORT:'Baffle Ck');
  FT.biteSetLoc(Object.assign({name:nm,lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:r.km},r.adhoc?{}:{spotId:k},GEN?{baffleLine:r.line||'M',sys:FT.SYS}:r.line&&r.line!=='B'?{baffleLine:r.line}:{}));FT.showTab('bite');});
function cards(){const L=list();if(!L.length)return '';const nm=nowM(),nh=nm/60;let h='';
  for(const r of L){const c=pred(r,Math.floor(nh)-16,Math.floor(nh)+40);const v=c.P.curve(nh),v2=c.P.curve(nh+0.25);
    const ar=v==null||v2==null?'':v2>v+0.005?'↑':v2<v-0.005?'↓':'→';const tr=v==null||v2==null?'':v2>v+0.005?'rising':v2<v-0.005?'falling':'near slack';
    const nHW=c.P.ext.find(e=>e.hi&&!e.weak&&e.t>nh),nSD=c.P.ext.find(e=>e.stand&&e.standT1>nh&&(!nHW||e.t<nHW.t)),nLW=c.P.ext.find(e=>!e.hi&&e.t>nh),nR=(c.R||[]).find(x=>x.t>nh);
    const ev=(e,lab)=>e?`${lab} ${fT(e.t*60,{weekday:'short'})} <span class="mut">±${Math.round(e.u)}′</span> (${e.h.toFixed(2)})`:'';
    h+=`<div class="gst gsp-card" style="border-left:3px solid ${r.col}"><small>${TY[r.type]?`<span class="gsp-ty" style="background:${TY[r.type].col}">${TY[r.type].s}</span> `:r.custom?'★ ':'📍 '}${esc(r.name)} · ${r.km.toFixed(1)} km${esc(lineTxt(r.line))} · <i>predicted</i></small><b>${v!=null?v.toFixed(2)+' m AHD '+ar:'—'}</b><small>predicted now${tr?' · '+tr:''}<br>${[ev(nHW,'next HW'),ev(nLW,c.trunc?'next resting low':'next LW')].filter(Boolean).join('<br>')}${nSD?`<br>🌗 stand ${fT(nSD.standT0*60,{weekday:'short'})}–${fT(nSD.standT1*60)} <span class="mut">no rise</span>`:''}${nR?`<br>▶ run-in ${fT(nR.t*60,{weekday:'short'})} <span class="mut">±${Math.round(nR.u)}′</span>`:''}</small>${FT.biteSetLoc?`<button class="sm gsp-bite" data-gbite="${esc(r.key)}">🎣 Bite times${TY[r.type]?' ('+TY[r.type].s+')':''}</button>`:''}</div>`;}
  return h;}
/* ---------- selector UI ---------- */
let onChange=()=>{};
function ui(){const el=$('gSpots');if(!el)return;const L=list();const selKeys=new Set(L.map(r=>r.key));const colOf={};L.forEach(r=>colOf[r.key]=r.col);
  const all=SP.all();const mine=all.filter(l=>l.custom),lms=all.filter(l=>l.builtin);
  const chip=(l)=>{const on=selKeys.has(l.id);return `<button data-sp="${esc(l.id)}" class="${on?'':'off'}" title="${esc(l.name)} — ${l.km.toFixed(2)} km"><i style="background:${on?colOf[l.id]:(l.custom&&l.color)||'#5a7a7e'}"></i>${l.custom?'★ ':''}${esc(l.name)}${l.alias?' <span class="mut">(renamed)</span>':''} <span class="mut">${l.km.toFixed(1)}</span></button>`;};
  const adhoc=L.filter(r=>r.adhoc).map(r=>`<button data-rm="${esc(r.key)}"><i style="background:${r.col}"></i>${esc(r.name)} ✕</button>`).join('');
  const CH=SP.channels?SP.channels():[];const lines=!GEN&&CH.length>1?`<select id="gSpLine" class="sm" style="max-width:9.5rem">${CH.map(c=>`<option value="${esc(c.id)}">${esc(c.short)}${c.est?' (est.)':''}</option>`).join('')}</select>`:GEN&&BT.LINES&&BT.LINES.length>1?`<select id="gSpLine" class="sm" style="max-width:9.5rem">${BT.LINES.map(l=>`<option value="${esc(l.id)}">${esc(SP.lineLabel(l.id,true))}</option>`).join('')}</select>`:'';
  const open=el.querySelector('details')?el.querySelector('details').open:false;
  el.innerHTML=`<details class="gsp"${open?' open':''}><summary>📍 <b>Spots</b> — predicted tide on the chart${L.length?` <span class="mut">(${L.length}: ${L.map(r=>`<span style="color:${r.col}">${esc(r.name)}</span>`).join(', ')})</span>`:' <span class="mut">(none selected)</span>'}</summary>
<p class="mut" style="margin:6px 0">Pick up to ${MAXSEL}. Dashed = predicted (Tides-tab model incl. your applied benchmarks), drawn ~2 days past now. ▲/▼ predicted high/low${L.some(r=>r.trunc)?', ▬ resting (pool) low':''}, ▶ run-in start; hollow markers in the lag panel. Your spots stay on this phone.</p>
${mine.length?`<div class="mut" style="font-size:.78rem">★ My spots</div><div class="row gleg">${mine.map(chip).join('')}</div>`:`<div class="mut" style="font-size:.78rem">No spots of your own on ${esc(GEN?FT.SYSSHORT||'this system':'Baffle Creek')} yet — add them on the Map tab (long-press).</div>`}
${lms.length?`<div class="mut" style="font-size:.78rem;margin-top:6px">Landmarks</div><div class="row gleg">${lms.map(chip).join('')}</div>`:''}
<div class="row gleg" style="margin-top:6px;align-items:center">${adhoc}<input id="gSpKm" type="number" inputmode="decimal" step="0.1" min="0" placeholder="km" style="width:5.5rem" aria-label="km from the mouth">${lines}<button id="gSpAdd" class="sm">＋ add km…</button>
<label class="mut" style="font-size:.78rem;display:inline-flex;align-items:center;gap:4px;margin-left:6px"><input type="checkbox" id="gSpBand"${band?' checked':''}> ± timing band</label>${L.length?'<button id="gSpClr" class="sm">clear</button>':''}</div>
<div class="mut" id="gSpMsg" style="font-size:.78rem"></div></details>`;
  const msg=t=>{const m=$('gSpMsg');if(m)m.textContent=t||'';};
  el.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{const id=b.dataset.sp;const i=sel.findIndex(s=>s.id===id);
    if(i>=0)sel.splice(i,1);else{if(list().length>=MAXSEL){msg(`Up to ${MAXSEL} spots — untick one first.`);return;}sel.push({id});}save();ui();onChange();});
  el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const k=b.dataset.rm;sel=sel.filter(s=>s.id||('km:'+(s.line||'')+':'+s.km)!==k);save();ui();onChange();});
  $('gSpAdd').onclick=()=>{const v=parseFloat($('gSpKm').value);const line=$('gSpLine')?$('gSpLine').value:(GEN?'M':'B');
    if(!isFinite(v)){msg('Type a distance in km from the mouth first.');$('gSpKm').focus();return;}
    const C0=CH.find(c=>c.id===line);const lo=C0?C0.min:GEN&&line!=='M'?(BT.LINES.find(l=>l.id===line)||{}).j||0:0,hi=C0?C0.max:GEN?BT.lineMax(line):BT.MAXKM;
    if(v<lo||v>hi){msg(`km must be between ${lo.toFixed(1)} and ${hi.toFixed(1)}${line!=='M'&&line!=='B'?' on '+SP.lineLabel(line):''}.`);return;}
    if(list().length>=MAXSEL){msg(`Up to ${MAXSEL} spots — untick one first.`);return;}
    const km=+v.toFixed(2);if(!sel.some(s=>!s.id&&s.km===km&&(s.line||'')===line))sel.push({km,line});save();ui();onChange();};
  $('gSpBand').onchange=e=>{band=e.target.checked;save();onChange();};
  if($('gSpClr'))$('gSpClr').onclick=()=>{sel=[];save();ui();onChange();};}
SP.onChange.push(()=>{cache.clear();ui();onChange();});
FT.gSpots={list,prepare,svgMain,lagPts,lagSvg,lagLegend,tipRows,cards,ui,
  active:()=>list().length>0,
  futureEnd:()=>list().length?nowM()+48*60:null,
  setOnChange:f=>{onChange=f||(()=>{});},
  clearCache:()=>cache.clear()};
})();
