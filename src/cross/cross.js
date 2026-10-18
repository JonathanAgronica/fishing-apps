/* ===== Shallow crossings: bars / rock bars you can't get over at low tide =====
   Private: stored ONLY in this phone's localStorage (mbj_cross, all systems, tagged .sys) + included in the spots JSON backup.
   Never shared, logged or published. A crossing = {id,name,lat,lng,km,line,sys,thr (m, predicted height at the crossing needed
   to get over, with the boat draft d0 it was set for), mode 'pred'|'gauge' (+ gauge input kept for display), obs[], note, g (show on Gauges)}.
   Closed windows = predicted water level at the crossing (same model as Tides, incl. Baffle single-high stands) below the
   effective threshold thr + (draft − d0). */
(function(){'use strict';
const FT=window.FT,B=window.BT,S=FT.spots;if(!B||!S)return;
const GEN=!!B.generic,SYS=FT.SYS||'baffle',KX='mbj_cross',KD='mbj_draft',KL=FT.k('mbj_xlaunch');
const E0=Date.UTC(2025,11,31,14),TZ='Australia/Brisbane';const hToMs=h=>E0+h*36e5,msToH=ms=>(ms-E0)/36e5;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fT=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace(' am','am').replace(' pm','pm');
const fD=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short',day:'numeric'}).format(new Date(ms));
const dayK=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date(ms));
const span=(a,b)=>{const x=fT(a),y=fT(b);if(dayK(a)!==dayK(b))return x+' – '+fD(b)+' '+y;return (x.slice(-2)===y.slice(-2)?x.slice(0,-2):x)+'–'+y;};
const load=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}};
const MAIN=GEN?'M':'B';const nl=l=>l||MAIN;
let all=load(KX,[]);if(!Array.isArray(all))all=[];
const mine=c=>(c.sys||'baffle')===SYS;
/* re-snap this system's crossings from lat/lng at load (in memory; same rule as spots: <=1.2 km and same line) */
if(S.resnap)all.forEach(c=>{if(c&&mine(c))S.resnap(c);});
const hooks=[];
function save(){try{localStorage.setItem(KX,JSON.stringify(all));}catch(e){}cache.clear();hooks.forEach(f=>{try{f()}catch(e){console.error('cross hook',e)}});}
const rid=()=>{const a=new Uint8Array(5);crypto.getRandomValues(a);return 'x'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');};
const clean=s=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').trim();
const draft=()=>{const v=+load(KD,0.3);return isFinite(v)?Math.max(0,Math.min(3,v)):0.3;};
function setDraft(v){v=Math.max(0,Math.min(3,+v||0));try{localStorage.setItem(KD,JSON.stringify(v));}catch(e){}cache.clear();hooks.forEach(f=>{try{f()}catch(e){}});}
const eff=c=>c.thr==null?null:+(c.thr+(draft()-(c.d0!=null?c.d0:draft()))).toFixed(3);
/* ---- channel tree (km = chainage from the mouth on every line) ---- */
function parentOf(id){id=nl(id);if(GEN){const L=B.LINES.find(x=>x.id===id);return !L||id==='M'?null:(L.parent||'M');}
  const c=S.channels().find(x=>x.id===id);return c?c.parent:null;}
function jOf(id){id=nl(id);if(GEN){const L=B.LINES.find(x=>x.id===id);return L?L.j:0;}const c=S.channels().find(x=>x.id===id);return c?c.j:0;}
function chain(p){const a=[[nl(p.line),p.km]];let id=nl(p.line),g=0;while(g++<8){const pa=parentOf(id);if(!pa)break;a.push([pa,jOf(id)]);id=pa;}return a;}
function onPath(p,x){return chain(p).some(([l,mx])=>l===nl(x.line)&&x.km<=mx+0.02);}
/* crossings you must pass between a and b (in either direction) */
function between(a,b){return all.filter(mine).filter(x=>x.thr!=null&&onPath(a,x)!==onPath(b,x));}
/* ---- predictions ---- */
const lineOpt=l=>GEN?nl(l):(nl(l)==='B'?undefined:l);
function opts(line){const bo=FT.baffleOpts?FT.baffleOpts():{};const o=Object.assign({},bo);delete o.line;const lo=lineOpt(line);if(lo)o.line=lo;return o;}
const cache=new Map();
function closed(c,h0,h1){const th=eff(c);if(th==null)return[];const o=opts(c.line);const k=[c.id,th,Math.floor(h0),Math.ceil(h1),o.hoff||0,o.badj||0].join('|');
  if(cache.has(k))return cache.get(k);const a=Math.floor(h0),b=Math.ceil(h1);const P=B.predictAt(c.km,a-3,b+3,o);const st=1/12,W=[];let cur=null;
  for(let h=a;h<=b+1e-9;h+=st){const v=P.curve(h);const shut=v!=null&&v<th;if(shut&&!cur)cur={a:h,min:v};else if(shut)cur.min=Math.min(cur.min,v);else if(!shut&&cur){cur.b=h;W.push(cur);cur=null;}}
  if(cur){cur.b=b;cur.open=true;W.push(cur);}
  const out=W.map(w=>({a:w.a,b:w.b,ta:hToMs(w.a),tb:hToMs(w.b),min:w.min,u:Math.round((P.cal.lwU||15)),cut:w.open}));if(cache.size>200)cache.clear();cache.set(k,out);return out;}
function hAt(c,h){const P=B.predictAt(c.km,h-3,h+3,opts(c.line));return P.curve(h);}
function statusAt(c,ms){const h=msToH(ms);const W=closed(c,h-14,h+40);const w=W.find(x=>x.a<=h&&x.b>h);const nx=W.find(x=>x.a>h);return{shut:!!w,until:w?w.tb:null,next:nx||null,W};}
/* ---- gauges this system can convert to ---- */
function gauges(){return GEN?(B.SYS.gauges||[]).filter(g=>!g.coastal&&g.km!=null&&(g.role==='tidal'||g.role==='partial')).map(g=>({id:g.id,name:g.name,km:g.km,line:g.line}))
  :[{id:'essendean',name:'Essendean Bridge 039267',km:35.25,line:'B'},{id:'hillsrd',name:'Hills Rd 539135 (Euleilah Ck)',km:25.24,line:'E'}];}
/* gauge level ↔ crossing height via the along-creek model: level at one place when the other passes through the value (median of 14 days of turns) */
const mlc=new Map();
function mapLevel(from,to,v){const mk_=[from.km,from.line,to.km,to.line,v,Math.floor(Date.now()/36e5/6)].join('|');if(mlc.has(mk_))return mlc.get(mk_);const r_=mapLevel0(from,to,v);if(mlc.size>100)mlc.clear();mlc.set(mk_,r_);return r_;}
function mapLevel0(from,to,v){const h0=msToH(Date.now())-24,h1=h0+15*24;const Pf=B.predictAt(from.km,h0-3,h1+3,opts(from.line)),Pt=B.predictAt(to.km,h0-3,h1+3,opts(to.line));
  const r=[];let pv=Pf.curve(h0);for(let h=h0+1/12;h<=h1;h+=1/12){const cv=Pf.curve(h);if(pv!=null&&cv!=null&&((pv<v&&cv>=v)||(pv>=v&&cv<v))){const x=Pt.curve(h);if(x!=null)r.push(x);}pv=cv;}
  if(r.length<4)return null;r.sort((a,b)=>a-b);const q=i=>r[Math.min(r.length-1,Math.max(0,Math.round(i*(r.length-1))))];
  const cT=Pt.cal||{};const flo=cT.trunc&&cT.nodeB&&cT.nodeB.floor!=null?cT.nodeB.floor:null;
  return{v:+q(0.5).toFixed(3),iqr:+(q(0.75)-q(0.25)).toFixed(3),n:r.length,valid:q(0.75)-q(0.25)<=0.3&&!(flo!=null&&q(0.5)<=flo+0.05)};}
/* ---- CRUD ---- */
const API={hooks,draft,setDraft,eff,between,onPath,closed,statusAt,hAt,gauges,mapLevel,
  list:()=>all.filter(mine).map(c=>Object.assign({},c)),get:id=>{const c=all.find(x=>x.id===id&&mine(x));return c?Object.assign({},c):null;},
  add(o){const sn=S.snap(o.lat,o.lng);if(sn.offKm>1.2)throw new Error(`That point is ${sn.offKm.toFixed(1)} km from the channel — tap closer.`);
    const c={id:rid(),sys:SYS,name:clean(o.name).slice(0,60)||('Crossing km '+sn.km.toFixed(1)),lat:+(+o.lat).toFixed(6),lng:+(+o.lng).toFixed(6),km:sn.km,line:sn.line,
      thr:o.thr==null||o.thr===''||!isFinite(+o.thr)?null:+(+o.thr).toFixed(3),d0:draft(),mode:o.mode==='gauge'?'gauge':'pred',gin:o.gin||null,note:clean(o.note).slice(0,200),g:true,obs:[],created:Date.now()};
    all.push(c);save();return API.get(c.id);},
  update(id,p){const c=all.find(x=>x.id===id&&mine(x));if(!c)return null;
    if(p.name!=null)c.name=clean(p.name).slice(0,60)||c.name;if(p.note!=null)c.note=clean(p.note).slice(0,200);
    if(p.thr!==undefined){c.thr=p.thr==null||p.thr===''||!isFinite(+p.thr)?null:+(+p.thr).toFixed(3);c.d0=draft();}
    if(p.mode)c.mode=p.mode==='gauge'?'gauge':'pred';if(p.gin!==undefined)c.gin=p.gin;if(p.g!==undefined)c.g=!!p.g;
    if(p.lat!=null&&p.lng!=null){const sn=S.snap(p.lat,p.lng);if(sn.offKm>1.2)throw new Error(`${sn.offKm.toFixed(1)} km from the channel — not moved.`);c.lat=+(+p.lat).toFixed(6);c.lng=+(+p.lng).toFixed(6);c.km=sn.km;c.line=sn.line;}
    save();return API.get(id);},
  remove(id){const n=all.length;all=all.filter(x=>!(x.id===id&&mine(x)));if(all.length!==n)save();},
  /* 'stuck' = couldn't get over now (needs more water), 'over' = just got over now (this much is enough) */
  observe(id,kind){const c=all.find(x=>x.id===id&&mine(x));if(!c)return null;const h=hAt(c,msToH(Date.now()));if(h==null)throw new Error('No prediction at this km right now.');
    const need=kind==='stuck'?h+0.05:h;const cur=eff(c);let thr=cur;
    if(cur==null)thr=need;else if(kind==='stuck'&&need>cur)thr=need;else if(kind==='over'&&need<cur)thr=need;
    c.thr=+(+thr).toFixed(3);c.d0=draft();c.mode='pred';c.obs=(c.obs||[]).concat([{t:Date.now(),h:+h.toFixed(3),k:kind}]).slice(-30);save();return{h,thr:c.thr};},
  launch(){return load(KL,null);},setLaunch(v){try{if(v)localStorage.setItem(KL,JSON.stringify(v));else localStorage.removeItem(KL);}catch(e){}cache.clear();hooks.forEach(f=>{try{f()}catch(e){}});},
  /* launch used for "can I get there": user choice, else the nearest ramp downstream on the spot's route, else the mouth */
  launchFor(p){const L=API.launch();if(L)return L;let best=null;
    for(const l of S.all()){const isR=l.ramp||/ramp/i.test(l.name||'');if(!isR)continue;const q={km:l.km,line:nl(l.line)};if(!onPath(p,q))continue;if(!best||l.km>best.km)best={km:l.km,line:nl(l.line),name:l.name};}
    return best||{km:0,line:MAIN,name:'Mouth'};},
  /* crossings between launch and spot, closed sometime in [ms0,ms1] */
  blockers(p,ms0,ms1,launch){const L=launch||API.launchFor(p);const X=between(L,{km:p.km,line:nl(p.line)});const h0=msToH(ms0),h1=msToH(ms1);
    return X.map(c=>({c,W:closed(c,h0-1,h1+1).filter(w=>w.ta<ms1&&w.tb>ms0)})).filter(r=>r.W.length);},
  reachNote(p,ms0,ms1,launch){if(!all.some(mine))return '';const R=API.blockers(p,ms0,ms1,launch);if(!R.length)return '';
    return `<div class="xwarn">⚠ ${R.map(r=>`No passage at <b>${esc(r.c.name)}</b> ${r.W.map(w=>span(w.ta,w.tb)).join(', ')}`).join(' · ')}</div>`;}
};
FT.cross=API;
/* ---- backup: ride along in the spots JSON export/import ---- */
const ex0=S.exportData,im0=S.importData;
S.exportData=()=>Object.assign(ex0(),{cross:load(KX,[]),draft:draft()});
S.importData=function(o,merge){const r=im0.apply(S,arguments);if(o&&Array.isArray(o.cross)){let n=0;for(const x of o.cross){if(!x||typeof x.lat!=='number'||typeof x.lng!=='number')continue;if(merge!==false&&all.some(c=>c.id===x.id))continue;
    all.push({id:typeof x.id==='string'?x.id.slice(0,20):rid(),sys:typeof x.sys==='string'?x.sys:'baffle',name:clean(x.name).slice(0,60)||'Crossing',lat:x.lat,lng:x.lng,km:+x.km||0,line:typeof x.line==='string'?x.line:undefined,thr:x.thr==null?null:+x.thr,d0:x.d0==null?null:+x.d0,mode:x.mode==='gauge'?'gauge':'pred',gin:x.gin||null,note:clean(x.note).slice(0,200),g:x.g!==false,obs:Array.isArray(x.obs)?x.obs.slice(-30):[],created:+x.created||Date.now()});n++;}
    if(n)save();if(r&&typeof r==='object')r.cross=n;}
  if(o&&o.draft!=null&&isFinite(+o.draft))setDraft(o.draft);return r;};
/* ================= Tides tab: shading + threshold line + 7-day list ================= */
function tideSet(km,o){const p={km,line:nl(o&&o.line)};const L=API.launchFor(p);return{p,L,X:between(L,p)};}
API.tideRange=function(km,o){const T=tideSet(km,o);if(!T.X.length)return null;const v=T.X.map(eff).filter(x=>x!=null);return v.length?{lo:Math.min(...v),hi:Math.max(...v)}:null;};
API.tideSvg=function(g){const T=tideSet(g.km,g.o);if(!T.X.length)return '';let s='';const cols=['#ff4d4d','#ff9a3d','#ffd84d'];
  T.X.forEach((c,i)=>{const col=cols[i%3],th=eff(c);const W=closed(c,g.t0-1,g.t1+1);
    for(const w of W){const a=Math.max(g.t0,w.a),b=Math.min(g.t1,w.b);if(b<=a)continue;
      s+=`<rect class="xshade" x="${g.x(a).toFixed(1)}" y="${g.T}" width="${(g.x(b)-g.x(a)).toFixed(1)}" height="${g.ph}" fill="${col}" opacity=".16"/><text x="${((g.x(a)+g.x(b))/2).toFixed(1)}" y="${g.T+g.ph-6-i*13}" fill="${col}" font-size="11" text-anchor="middle">⚠ no passage</text>`;}
    if(th>=g.mn&&th<=g.mx)s+=`<line class="xthr" x1="${g.L}" x2="${g.W-g.R}" y1="${g.y(th).toFixed(1)}" y2="${g.y(th).toFixed(1)}" stroke="${col}" stroke-width="1.6" stroke-dasharray="7 4"/><text x="${g.W-g.R-4}" y="${(g.y(th)-4).toFixed(1)}" fill="${col}" font-size="11" text-anchor="end">⚠ ${esc(c.name)} needs ${th.toFixed(2)} m (at the crossing)</text>`;});
  return s;};
API.tideList=function(km,o,t0){let box=document.getElementById('xTides');const ch=document.getElementById('bt-chart');if(!ch)return;
  if(!box){box=document.createElement('div');box.id='xTides';const lg=ch.nextElementSibling;(lg||ch).after(box);}
  const mineL=all.filter(mine);if(!mineL.length){box.innerHTML='';return;}
  const T=tideSet(km,o);const nowH=msToH(Date.now());const h0=Math.max(t0,Math.floor(nowH)),h1=h0+24*7;
  const ramps=S.all().filter(l=>l.ramp||/ramp/i.test(l.name||'')||l.custom);const cur=API.launch();
  const sel=`<label class="mut">Launch / ramp <select id="xLaunch"><option value="">auto (${esc(T.L.name||'km '+T.L.km.toFixed(1))})</option><option value="mouth"${cur&&cur.name==='Mouth'?' selected':''}>Mouth</option>${ramps.map(l=>`<option value="${esc(l.id)}"${cur&&cur.id===l.id?' selected':''}>${esc(l.name)} · km ${l.km.toFixed(1)}</option>`).join('')}</select></label> <label class="mut">Boat draft <input id="xDraft" type="number" step="0.05" min="0" max="3" value="${draft()}" style="width:5em"> m</label>`;
  let body='';
  if(!T.X.length)body=`<p class="mut">No shallow crossing between ${esc(T.L.name||'the launch')} and this spot.</p>`;
  else body=T.X.map(c=>{const th=eff(c);if(th==null)return `<p>⚠ <b>${esc(c.name)}</b> — no height set yet (Map → tap the ⚠ pin → “I got stuck / got over here now”).</p>`;
    const W=closed(c,h0,h1).filter(w=>w.tb>Date.now());const by={};W.forEach(w=>{const k=dayK(w.ta);(by[k]=by[k]||[]).push(w);});
    const st=statusAt(c,Date.now());
    return `<div class="xrow"><b>⚠ ${esc(c.name)}</b> <span class="mut">${S.kmLabel(c.km,c.line)} · needs ${th.toFixed(2)} m at the crossing${c.mode==='gauge'&&c.gin?` (set from ${esc(c.gin.name)} ${(+c.gin.v).toFixed(2)} m)`:''}</span>
      <div class="${st.shut?'xshut':'xopen'}">${st.shut?`Closed now — no passage until ${fT(st.until)}`:`Open now${st.next?` · next closed ${fD(st.next.ta)} ${span(st.next.ta,st.next.tb)}`:''}`}</div>
      <table class="xtbl">${Object.keys(by).map(k=>`<tr><td>${fD(by[k][0].ta)}</td><td>${by[k].map(w=>`No passage ${span(w.ta,w.tb)}${w.tb-w.ta>7*36e5?' <span class="mut">(long — neap/stand)</span>':''}`).join('<br>')}</td></tr>`).join('')||'<tr><td colspan="2" class="mut">Open all week</td></tr>'}</table></div>`;}).join('');
  box.innerHTML=`<details class="dc xbox" data-k="xtides" open><summary>⚠ Shallow crossings on the way here${T.X.length?` (${T.X.length})`:''}</summary>${sel}${body}<p class="mut" style="font-size:.8rem">Shaded on the graph: predicted level at the crossing below what it needs (your draft ${draft().toFixed(2)} m). Estimates — allow ± the timing shown on the tide cards. Private: crossings stay on this phone.</p></details>`;
  const ls=box.querySelector('#xLaunch');ls.onchange=()=>{const v=ls.value;if(!v)API.setLaunch(null);else if(v==='mouth')API.setLaunch({km:0,line:MAIN,name:'Mouth'});else{const l=S.get(v);if(l)API.setLaunch({id:l.id,km:l.km,line:nl(l.line),name:l.name});}};
  box.querySelector('#xDraft').onchange=e=>setDraft(e.target.value);};
/* ================= Gauges tab: threshold converted to each gauge + no-pass shading + toggles ================= */
API.gaugeSvg=function(g){const X=all.filter(mine).filter(c=>c.thr!=null);togg(g.redraw);if(!X.length)return '';let s='';const cols=['#ff4d4d','#ff9a3d','#ffd84d'];
  X.forEach((c,i)=>{if(c.g===false)return;const col=cols[i%3];const W=closed(c,g.v0/60-1,g.v1/60+1);
    for(const w of W){const a=Math.max(g.v0,w.a*60),b=Math.min(g.v1,w.b*60);if(b<=a)continue;s+=`<rect class="xgshade" x="${g.X(a).toFixed(1)}" y="${g.P1.y0}" width="${(g.X(b)-g.X(a)).toFixed(1)}" height="${g.P1.h}" fill="${col}" opacity=".13"><title>No passage at ${esc(c.name)} ${span(w.ta,w.tb)}</title></rect>`;}
    for(const gg of g.gauges||[]){const m=mapLevel({km:c.km,line:c.line},gg,eff(c));if(!m)continue;const yy=g.Y1(m.v);
      s+=`<line class="xgthr" x1="${g.X(g.v0)}" x2="${g.X(g.v1)}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="${m.valid?'7 4':'2 4'}" opacity="${m.valid?1:.6}"/><text x="${(g.X(g.v1)-4).toFixed(1)}" y="${(yy-4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="${col}">⚠ ${esc(c.name)}: ${esc(gg.short||gg.name)} ≥ ${m.v.toFixed(2)}${m.valid?'':' (rough)'}</text>`;}});
  return s;};
function togg(redraw){const lg=document.getElementById('gLegend');if(!lg)return;let el=document.getElementById('gXTog');const X=all.filter(mine);
  if(!X.length){if(el)el.remove();return;}if(!el){el=document.createElement('div');el.id='gXTog';el.className='row gleg';lg.after(el);}
  el.innerHTML=X.map(c=>`<button data-x="${esc(c.id)}" class="${c.g===false?'off':''}"><i style="background:#ff4d4d"></i>⚠ ${esc(c.name)}${c.thr==null?' (no height)':''}</button>`).join('');
  el.querySelectorAll('button').forEach(b=>b.onclick=()=>{const c=API.get(b.dataset.x);API.update(c.id,{g:c.g===false});redraw&&redraw();});}
/* ================= Plan my day: route around closed crossings ================= */
/* pair closures for the DP: key "a_b" (indices into the plan's locations) → closed [t0,t1] ms windows of every crossing between them */
API.planBlocks=function(locs,ms0,ms1){if(!all.some(c=>mine(c)&&c.thr!=null))return null;const out={};let any=false;
  for(let a=0;a<locs.length;a++)for(let b=0;b<locs.length;b++){if(a===b)continue;const X=between({km:locs[a].km,line:nl(locs[a].line)},{km:locs[b].km,line:nl(locs[b].line)});if(!X.length)continue;
    const W=[];for(const c of X)for(const w of closed(c,msToH(ms0)-2,msToH(ms1)+2))W.push([w.ta,w.tb]);if(W.length){out[a+'_'+b]=W;any=true;}}
  return any?out:null;};
API.planNotes=function(P){if(!all.some(c=>mine(c)&&c.thr!=null))return [];const L=P.spots[P.launch]||P.spots[P.spots.length-1];const notes=[];if(!L)return notes;
  for(const b of P.blocks){if(b.ty!=='fish')continue;const p=P.spots[b.loc];const X=between({km:L.km,line:nl(L.line)},{km:p.km,line:nl(p.line)});
    for(const c of X){const W=closed(c,msToH(b.t0)-1,msToH(b.t1)+8);const during=W.find(w=>w.ta>b.t0&&w.ta<b.t1);const atStart=W.find(w=>w.ta<=b.t0&&w.tb>b.t0);const after=W.find(w=>w.ta>=b.t1&&w.ta<b.t1+3*36e5);
      if(during){const m=`⚠ ${c.name}: no passage ${span(during.ta,during.tb)} — leave before ${fT(during.ta)} to get back, or stay this side until ${fT(during.tb)}`;b.why=(b.why||[]).concat([m]);notes.push(m);}
      else if(atStart){const m=`⚠ ${c.name} closed until ${fT(atStart.tb)} — you may be stuck below it at the start`;b.why=(b.why||[]).concat([m]);notes.push(m);}
      else if(after){const m=`⚠ ${c.name} closes ${span(after.ta,after.tb)} — head back by ${fT(after.ta)}`;b.why=(b.why||[]).concat([m]);notes.push(m);}}}
  return notes;};
/* ================= Map: ⚠ pins, popups, add mode, list card ================= */
let LF=null,map=null,grp=null,wired=false,xAdd=false;const mk=new Map();
function icon(c){return LF.divIcon({className:'mpin-wrap',html:`<div class="mx${c.thr==null?' unset':''}">⚠</div>`,iconSize:[26,26],iconAnchor:[13,24]});}
function popHtml(c){const th=eff(c);const st=th!=null?statusAt(c,Date.now()):null;const h=hAt(c,msToH(Date.now()));const gs=gauges();
  return `<div class="mpop xpop"><h3>⚠ ${esc(c.name)} <span class="tag xtag">shallow crossing</span></h3>
   <div class="mut">${S.kmLabel(c.km,c.line)}${c.note?'<br>📝 '+esc(c.note):''}</div>
   <table><tr><td>Needs</td><td>${th!=null?`<b>${th.toFixed(2)} m</b> at the crossing <span class="mut">(draft ${draft().toFixed(2)} m)</span>${c.mode==='gauge'&&c.gin?`<br><span class="mut">set as ${esc(c.gin.name)} ≥ ${(+c.gin.v).toFixed(2)} m</span>`:''}`:'<span class="mut">not set yet</span>'}</td></tr>
   <tr><td>Now</td><td>${h!=null?h.toFixed(2)+' m predicted':'—'}${st?(st.shut?` · <b class="xshut">no passage until ${fT(st.until)}</b>`:` · <b class="xopen">open</b>${st.next?` · next closed ${fD(st.next.ta)} ${span(st.next.ta,st.next.tb)}`:''}`):''}</td></tr></table>
   <div class="b"><button data-xa="stuck">🛑 I got stuck here now</button><button data-xa="over">✅ I just got over here now</button><button data-xa="copy">📋 Copy coordinates</button></div><div class="xcopy"></div>
   <div class="xform"><div class="mut">Name</div><input type="text" class="xnm" maxlength="60" value="${esc(c.name)}">
    <div class="mut">Height needed, entered as</div><select class="xmode"><option value="pred"${c.mode!=='gauge'?' selected':''}>predicted height at this crossing (m)</option>${gs.map(g=>`<option value="g:${esc(g.id)}"${c.mode==='gauge'&&c.gin&&c.gin.id===g.id?' selected':''}>reading at ${esc(g.name)} (m, Gauges chart)</option>`).join('')}</select>
    <input type="number" step="0.01" class="xthrI" value="${c.mode==='gauge'&&c.gin?(+c.gin.v).toFixed(2):(c.thr!=null?c.thr.toFixed(2):'')}" placeholder="m — or use the buttons above">
    <div class="mut">Note</div><input type="text" class="xnt" maxlength="200" value="${esc(c.note||'')}">
    <label class="mut"><input type="checkbox" class="xg"${c.g!==false?' checked':''}> show on Gauges graph</label>
    <div class="b"><button class="pri" data-xa="save">💾 Save</button><button data-xa="tides">🌊 Tides here</button><button data-xa="del">🗑 Delete</button></div><div class="xmsg mut"></div><div class="mut" style="font-size:.78rem">Drag the ⚠ pin to move it. Private — stays on this phone (in the spots backup).</div></div></div>`;}
function openX(id){const c=API.get(id),m=mk.get(id);if(!c||!m||!map)return;m.unbindPopup();m.bindPopup(popHtml(c),{maxWidth:270,minWidth:230,autoPanPaddingTopLeft:[10,60],autoPanPadding:[20,60]}).openPopup();wire(c,m);}
function readThr(el){const md=el.querySelector('.xmode').value,v=el.querySelector('.xthrI').value;if(v===''||!isFinite(+v))return{thr:undefined};
  if(md==='pred')return{thr:+v,mode:'pred',gin:null};const g=gauges().find(x=>'g:'+x.id===md);const c=API._cur;const m=mapLevel(g,{km:c.km,line:c.line},+v);
  if(!m)throw new Error('Can’t convert that gauge level here (gauge doesn’t reach that level in the model) — enter the height at the crossing instead.');return{thr:m.v,mode:'gauge',gin:{id:g.id,name:g.name,v:+v,valid:m.valid}};}
function wire(c,m){const el=m.getPopup().getElement();if(!el)return;API._cur=c;const msg=t=>{const x=el.querySelector('.xmsg');if(x)x.innerHTML=t;};
  el.querySelectorAll('[data-xa]').forEach(b=>b.onclick=()=>{const a=b.dataset.xa;try{
    if(a==='stuck'||a==='over'){const r=API.observe(c.id,a);openX(c.id);setTimeout(()=>{const e=m.getPopup()&&m.getPopup().getElement();const x=e&&e.querySelector('.xmsg');if(x)x.innerHTML=(a==='stuck'?'Logged: stuck at ':'Logged: got over at ')+r.h.toFixed(2)+' m predicted → needs '+r.thr.toFixed(2)+' m. Refine any time.';},30);}
    else if(a==='save'){const t=readThr(el);const p={name:el.querySelector('.xnm').value,note:el.querySelector('.xnt').value,g:el.querySelector('.xg').checked};if(t.thr!==undefined)Object.assign(p,t);API.update(c.id,p);openX(c.id);}
    else if(a==='del'){if(!confirm(`Delete crossing “${c.name}”?`))return;map.closePopup();API.remove(c.id);}
    else if(a==='copy'){FT.copyCoords&&FT.copyCoords(c.lat,c.lng,el.querySelector('.xcopy'));}
    else if(a==='tides'){map.closePopup();FT.baffleSelect&&FT.baffleSelect(c.km,c.name,c.line);FT.showTab&&FT.showTab('baffle');}}catch(e){msg('⚠ '+esc(e.message));}});}
API.drawMap=function(lf,mp){LF=lf;map=mp;if(!grp)grp=LF.layerGroup().addTo(map);grp.clearLayers();mk.clear();
  for(const c of API.list()){const m=LF.marker([c.lat,c.lng],{icon:icon(c),draggable:true,title:c.name,zIndexOffset:600}).addTo(grp);m.bindTooltip('⚠ '+esc(c.name),{direction:'top',offset:[0,-22]});
    m.on('click',()=>openX(c.id));m.on('dragend',()=>{const p=m.getLatLng();try{API.update(c.id,{lat:p.lat,lng:p.lng});}catch(e){m.setLatLng([c.lat,c.lng]);}});mk.set(c.id,m);}
  if(!wired){wired=true;map.on('click',e=>{if(!xAdd)return;setXAdd(false);addForm(e.latlng);});
    const b=document.getElementById('mAdd');if(b&&!document.getElementById('mXAdd')){const x=document.createElement('button');x.className='sm';x.id='mXAdd';x.textContent='⚠ Crossing';x.title='Add a shallow crossing (bar / rock bar you can’t get over at low tide)';b.after(x);x.onclick=()=>setXAdd(!xAdd);}
    const lg=map._controlCorners&&document.querySelector('.mtleg');if(lg&&!lg.querySelector('.xleg'))lg.insertAdjacentHTML('beforeend','<span class="xleg"><b class="mx sm">⚠</b>Shallow crossing</span>');}
  listCard();};
function setXAdd(on){xAdd=on;const b=document.getElementById('mXAdd');if(b)b.classList.toggle('on',on);const h=document.getElementById('mHint');if(h){h.innerHTML=on?'Tap the channel where the bar / rock bar is…':'';h.style.display=on?'block':'none';}}
function addForm(ll){let sn;try{sn=S.snap(ll.lat,ll.lng);}catch(e){return;}const pop=LF.popup({maxWidth:270,minWidth:230}).setLatLng(ll);
  if(sn.offKm>1.2){pop.setContent(`<div class="mpop">That point is ${sn.offKm.toFixed(1)} km from the channel — crossings must be within 1.2 km.</div>`).openOn(map);return;}
  pop.setContent(`<div class="mpop xpop"><h3>⚠ New shallow crossing</h3><div class="mut">Snaps to <b>${S.kmLabel(sn.km,sn.line)}</b></div>
   <input type="text" class="xnm" maxlength="60" placeholder="Name (e.g. the bar or riffle)"><input type="number" step="0.01" class="xthrI" placeholder="Height needed at the crossing (m) — optional">
   <input type="text" class="xnt" maxlength="200" placeholder="Note (optional)"><div class="mut">Don’t know the height? Save it, then tap “I got stuck here now” / “I just got over here now” when you’re there.</div>
   <div class="b"><button class="pri" data-x="ok">💾 Save crossing</button><button data-x="no">Cancel</button></div></div>`).openOn(map);
  const el=pop.getElement();setTimeout(()=>{const n=el.querySelector('.xnm');n&&n.focus();},50);
  el.querySelector('[data-x=ok]').onclick=()=>{try{const v=el.querySelector('.xthrI').value;const c=API.add({lat:ll.lat,lng:ll.lng,name:el.querySelector('.xnm').value,note:el.querySelector('.xnt').value,thr:v===''?null:+v});map.closePopup();setTimeout(()=>openX(c.id),60);}catch(e){alert(e.message);}};
  el.querySelector('[data-x=no]').onclick=()=>map.closePopup();}
API.addForm=ll=>addForm(ll);
function listCard(){const tab=document.getElementById('tab-map');if(!tab)return;let card=document.getElementById('xCard');
  if(!card){card=document.createElement('section');card.className='card';card.id='xCard';const ml=document.getElementById('mList');const sec=ml&&ml.closest('section');(sec||tab.lastElementChild).after(card);}
  const L=API.list();card.innerHTML=`<h2>⚠ Shallow crossings <span class="mut">${L.length||''}</span></h2>${L.length?'<div class="xlist">'+L.map(c=>{const th=eff(c);const st=th!=null?statusAt(c,Date.now()):null;
    return `<div class="xli" data-x="${esc(c.id)}"><b>⚠ ${esc(c.name)}</b> <span class="mut">${S.kmLabel(c.km,c.line)} · ${th!=null?'needs '+th.toFixed(2)+' m':'height not set'}</span>${st?`<br><span class="${st.shut?'xshut':'xopen'}">${st.shut?'No passage until '+fT(st.until):'Open'+(st.next?' · next closed '+fD(st.next.ta)+' '+span(st.next.ta,st.next.tb):'')}</span>`:''}</div>`;}).join('')+'</div>':'<p class="mut">None yet. Tap <b>⚠ Crossing</b> above the map, then tap the bar / rock bar on the channel.</p>'}
   <label class="mut">Boat draft (all crossings) <input type="number" id="xDraftM" step="0.05" min="0" max="3" value="${draft()}" style="width:5em"> m</label>
   <p class="mut" style="font-size:.8rem;margin:6px 0 0">🔒 Crossings are private — only on this phone and in your spots backup; never shared. Shown on Tides (shading + list), Gauges (threshold), Plan, Calendar and My spots.</p>`;
  card.querySelectorAll('.xli').forEach(d=>d.onclick=()=>{const c=API.get(d.dataset.x);if(c&&map){map.setView([c.lat,c.lng],Math.max(map.getZoom(),14));setTimeout(()=>openX(c.id),200);document.getElementById('mMap').scrollIntoView({block:'center'});}});
  card.querySelector('#xDraftM').onchange=e=>setDraft(e.target.value);}
API._openX=openX;
hooks.push(()=>{if(map)API.drawMap(LF,map);});
/* everything else that shows crossings re-renders through the spots hook (Tides, Bite, Calendar list) */
hooks.push(()=>{S.onChange.forEach(f=>{try{f()}catch(e){}});});
})();
