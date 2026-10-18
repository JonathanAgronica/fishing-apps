/* ===================== Gauges tab — any river system (Baffle format) =====================
   Same layout as Baffle's Gauges tab (latest cards, multi-series chart with lag panel, running stats, peaks list,
   fresh-flow indicator) for every other system. Data: data/sysg/arch/<station>/<YYYY-MM>.csv (append-only archive kept
   by the box routine from BoM 7-day tables + the Qld DES storm-tide feed) and this app's tide model (window.BT).
   Lags are measured against the system's base-port harmonic prediction (the same predictions the model shifts), so
   "drift" = how far the gauge's observed timing sits from the model at that chainage. */
(function(){
'use strict';
const FT=window.FT,BT=window.BT,$=id=>document.getElementById(id);if(!BT||!BT.generic)return;
const S=BT.SYS,PORT=S.port,Z0=PORT.harm.z0;
const E0=Date.UTC(2025,11,31,14);
const toMs=m=>E0+m*60000, nowM=()=>(Date.now()-E0)/60000;
const fT=(m,o)=>new Intl.DateTimeFormat('en-AU',Object.assign({timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',hour12:true},o||{})).format(new Date(toMs(m))).replace(' am','am').replace(' pm','pm');
const fDT=m=>fT(m,{weekday:'short',day:'numeric',month:'short'});
const hm=min=>{if(min==null||isNaN(min))return '—';const s=min<0?'−':'';min=Math.abs(min);return s+Math.floor(min/60)+':'+String(Math.round(min%60)).padStart(2,'0');};
const sg=min=>(min<0?'':'+')+hm(min);
const ago=m=>{const d=Math.max(0,nowM()-m);return d<1?'just now':d<90?Math.round(d)+' min ago':d<48*60?(d/60).toFixed(1)+' h ago':(d/1440).toFixed(1)+' days ago';};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const short=n=>String(n).split(' / ')[0].replace(/^Junction /,'').replace(/^.* at /,'').replace(/\s*\(.*\)\s*$/,'').replace(/ Tide$/,'').trim()||n;
const PAL=['#e5484d','#2ca02c','#ff7f0e','#d62728','#9467bd','#8c564b','#e377c2','#bcbd22','#17becf','#7f7f7f'];
const MPAL=['#ff9896','#98df8a','#ffbb78','#ff9896','#c5b0d5','#c49c94','#f7b6d2','#dbdb8d','#9edae5','#c7c7c7'];
const GA=(S.gauges||[]).filter(g=>g.role==='tidal'||g.role==='partial').sort((a,b)=>(a.line===b.line?0:a.line==='M'?-1:1)||a.km-b.km);
const REF=S.ref&&!S.ref.inSystem?S.ref:null,REFIN=S.ref&&S.ref.inSystem?S.ref:null,FR=S.fresh||null;
const PLACES=[];for(const lid in BT.NBY)for(const n of BT.NBY[lid])if(n.kind==='msq'&&n.km>0.2&&!PLACES.some(p=>p.name===n.name))PLACES.push({name:n.name,km:n.km,line:lid});
PLACES.sort((a,b)=>a.km-b.km);
/* ---------- series catalogue ---------- */
const SER=[];
if(REF){SER.push({id:'ref',lab:short(REF.name)+' obs',col:'#3b8fd9',k:'line',on:true,st:REF.id});
  if(REF.src==='des')SER.push({id:'refp',lab:short(REF.name)+' MSQ pred',col:'#8fb8de',k:'line',dash:'3 3',on:false,st:REF.id,col2:true});}
SER.push({id:'port',lab:PORT.name+' pred (MSQ)',col:'#5cc8ff',k:'model',dash:'5 3',on:!REF,fn:'port'});
PLACES.slice(0,4).forEach((p,i)=>SER.push({id:'pl'+i,lab:p.name+' pred (MSQ offsets)',col:['#17becf','#7fd3c4','#4fa3a5','#a0e0d8'][i],k:'model',dash:'7 4',on:i===0&&GA.length<2,km:p.km,line:p.line}));
// many gauges (Brisbane): show ≤6 by default — main-channel gauges spread along the river + the first tributary ones
const DEF=new Set();(()=>{if(GA.length<=6){GA.forEach(g=>DEF.add(g.id));return;}const M=GA.filter(g=>g.line==='M'),T=GA.filter(g=>g.line!=='M');
  const n=Math.min(M.length,4);for(let i=0;i<n;i++)DEF.add(M[Math.round(i*(M.length-1)/Math.max(1,n-1))].id);T.slice(0,6-DEF.size).forEach(g=>DEF.add(g.id));})();
const _sc={};GA.forEach(g=>{const n=short(g.name);_sc[n]=(_sc[n]||0)+1;});const gname=g=>short(g.name)+(_sc[short(g.name)]>1?(g.src==='des'?' (DES)':' '+g.id):'');
GA.forEach((g,i)=>{SER.push({id:'g'+g.id,lab:short(g.name)+(g.src==='des'?' (DES)':' '+g.id)+(g.role==='partial'?' (part-tidal)':''),col:PAL[i%PAL.length],k:'step',on:DEF.has(g.id),st:g.id,g,dots:true});
  SER.push({id:'m'+g.id,lab:gname(g)+' model',col:MPAL[i%MPAL.length],k:'model',dash:'2 3',on:false,km:g.km,line:g.line,g});});
if(GA.length)SER.push({id:'lags',lab:'Lag panel',col:'#c9a227',k:'panel',on:true});
if(FR)SER.push({id:'fresh',lab:short(FR.name)+' '+FR.id,col:'#b48cff',k:'panel',on:true,st:FR.id});
const OKEY=FT.k?FT.k('ft_gauge_on'):'ft_gauge_on_'+FT.SYS;
const on=(()=>{try{return JSON.parse(localStorage.getItem(OKEY)||'null')||{};}catch(e){return{};}})();SER.forEach(s=>{if(on[s.id]===undefined)on[s.id]=s.on;});
/* ---------- static texts ---------- */
$('gTitle').textContent='📈 Tide propagation — '+S.name;
const refTxt=REFIN?`${esc(REFIN.name)} (gauge at the entrance, also plotted as a gauge)`:REF?`${esc(REF.name)} (${REF.src==='des'?'Qld DES storm-tide site':'BoM tide station '+esc(REF.id)}${REF.dist!=null?', '+REF.dist+' km from the mouth':''})`:'';
$('gHelp').innerHTML=`Drag sideways to pan · pinch / mouse-wheel or −/＋ to zoom · tap for values. Times AEST. Levels ≈ m AHD: reference tide ${REF?'centred on its mean sea level':'from '+esc(PORT.name)+' harmonics'}; gauges not on AHD are shifted to the model (see legend). Lower panel: lag of each gauge high / low${GA.some(g=>g.role==='partial')?' / water-starts-rising':''} after the matching <b>${esc(PORT.name)}</b> predicted high/low (the model's base port); dashed lines = the app model's lag at that gauge; error bars = ± half the time the gauge sat at that level.`;
$('gSrc').innerHTML=`Sources: Bureau of Meteorology flood-warning water-level tables${GA.length?' ('+GA.map(g=>esc(g.id)+' '+esc(gname(g))).join(', ')+')':''}${FR?', fresh-flow gauge '+esc(FR.id)+' '+esc(short(FR.name)):''}${REF||REFIN?'; reference '+refTxt:''}; Qld DES storm-tide 7-day feed (CC BY 4.0); ${esc(PORT.name)} predictions from MSQ official tide tables (harmonics fitted offline). Archived every ~3 h by the site routine into <a href="https://github.com/JonathanAgronica/fishing-apps/tree/main/data/sysg/arch" target="_blank" rel="noopener">data/sysg/arch</a> so the record keeps growing beyond BoM's 7-day window.`;
/* ---------- data ---------- */
let IDX=null,fetchedFrom='',lastFetch=0,shown=false,view=null,allLoaded=false;
const RAW={};      // station id -> Map(month -> rows [[m,v,p]])
const ser={};      // series id -> [[m,v]]
let EV={},ST={},OFF={},REFOFF=0;
async function getTxt(u){const r=await fetch(u+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);if(r.headers.get('x-ft-cache'))fetchedFrom='cache';return r.text();}
function parseCsv(t){const out=[];for(const l of t.split('\n')){if(!l||l[0]==='#')continue;const f=l.split(',');const m=+f[0];if(!isFinite(m))continue;out.push([m,f[1]===''||f[1]==null?null:+f[1],f[2]===''||f[2]==null?null:+f[2]]);}return out;}
function stations(){return [REF&&REF.id,...GA.map(g=>g.id),FR&&FR.id].filter(Boolean);}
async function loadMonths(all){
  const want=[];const cut=nowM()-40*1440;
  for(const id of stations()){const e=IDX&&IDX.st&&IDX.st[id];if(!e)continue;RAW[id]=RAW[id]||new Map();
    e.months.forEach((mo,i)=>{const last=i>=e.months.length-2;const [y,mm]=mo.split('-').map(Number);const end=(Date.UTC(y,mm,1)-E0)/60000-600;
      if((all||last||end>cut)&&(!RAW[id].has(mo)||i===e.months.length-1))want.push([id,mo]);});}
  await Promise.all(want.map(([id,mo])=>getTxt(`data/sysg/arch/${id}/${mo}.csv`).then(t=>RAW[id].set(mo,parseCsv(t))).catch(()=>{})));
  if(all)allLoaded=true;}
function rows(id){const M=RAW[id];if(!M)return[];return [...M.keys()].sort().flatMap(k=>M.get(k));}
async function load(force){
  if(!force&&IDX&&Date.now()-lastFetch<4*60e3)return;
  fetchedFrom='network';
  try{IDX=JSON.parse(await getTxt('data/sysg/index.json'));await loadMonths(allLoaded);}
  catch(e){if(!IDX){$('gLatest').innerHTML='<div class="notice err">Couldn\'t load gauge data ('+esc(e.message)+'). Connect once to cache it for offline use.</div>';noGaugeNote();return;}}
  lastFetch=Date.now();build();
  if(!view)setRange(7,true);
  render();}
/* ---------- derived: series, events, lags, stats ---------- */
function build(){
  if(REF){const R=rows(REF.id);const obs=R.filter(r=>r[1]!=null),pr=R.filter(r=>r[2]!=null);
    // LAT/LGH -> ≈AHD: subtract the mean of the MSQ prediction (DES) or of the observations (BoM tide station)
    const base=REF.src==='des'&&pr.length?pr.map(r=>r[2]):obs.map(r=>r[1]);REFOFF=base.length?base.reduce((a,b)=>a+b,0)/base.length:0;
    if(REF.datum==='AHD')REFOFF=0;
    ser.ref=obs.map(r=>[r[0],+(r[1]-REFOFF).toFixed(3)]);ser.refp=pr.map(r=>[r[0],+(r[2]-REFOFF).toFixed(3)]);}
  if(FR)ser.fresh=rows(FR.id).filter(r=>r[1]!=null).map(r=>[r[0],r[1]]);
  EV={};ST={};
  for(const g of GA){const raw=rows(g.id).filter(r=>r[1]!=null).map(r=>[r[0],r[1]]);g._raw=raw;
    const ev=gaugeEvents(raw,g.role==='partial');const cal=BT.calAt(g.km,{line:g.line});
    const m0=raw.length?raw[0][0]:nowM(),m1=raw.length?raw[raw.length-1][0]:nowM();
    const BE=BT.portExtremes(m0/60-14,m1/60+2);const out=[];
    for(const e of ev){const hi=e.k==='HW';const ml=hi?cal.hwLag:cal.lwLag;let best=null,bd=1e9;
      for(const b of BE){if(b.hi!==hi)continue;const d=Math.abs(e.t-(b.t*60+ml));if(d<bd){bd=d;best=b;}}
      if(!best||bd>300)continue;const bt=best.t*60;const mh=hi?cal.hwLvl(best.h):cal.lwLvl(best.h);
      out.push(Object.assign({},e,{bt,bh:best.h,lag:Math.round(e.t-bt),model:Math.round(ml),mh}));}
    // datum offset: gauges not on AHD are shifted so their highs match the model's highs (median)
    let off=0;if(g.datum!=='AHD'){const d=out.filter(e=>e.k==='HW').map(e=>e.v-e.mh).sort((a,b)=>a-b);off=d.length?d[d.length>>1]:(raw.length?raw.reduce((a,r)=>a+r[1],0)/raw.length:0);}
    OFF[g.id]=off;ser['g'+g.id]=raw.map(r=>[r[0],+(r[1]-off).toFixed(3)]);
    EV[g.id]=out;const last7=nowM()-7*1440;
    for(const k of ['HW',g.role==='partial'?'RISE':'LW']){const model=k==='HW'?Math.round(cal.hwLag):Math.round(cal.lwLag);
      ST[g.id+'_'+k]={g,k,all:stats(out,k),last7d:stats(out,k,last7),model,est:cal.est};}}}
function stats(ev,k,since){const L=ev.filter(e=>e.k===k&&(since==null||e.bt>=since)).map(e=>e.lag);const U=ev.filter(e=>e.k===k&&(since==null||e.bt>=since)).map(e=>e.u).sort((a,b)=>a-b);
  if(!L.length)return{n:0};const m=L.reduce((a,b)=>a+b,0)/L.length;const sd=L.length>1?Math.sqrt(L.reduce((a,b)=>a+(b-m)**2,0)/(L.length-1)):null;return{n:L.length,mean:m,sd,u_med:U[U.length>>1]};}
/* peaks/lows of a gauge series — same method the system builder used to fit the model (so drift ≈ 0 when the model fits):
   readings interpolated to 5 min, 35-min running mean, extreme over ±3 h with ≥5 cm relief. Error bar = ± half the time the
   raw readings sat within 1.5 cm of the extreme. Part-tidal gauges also give RISE = end of the low plateau (water starts rising). */
function gaugeEvents(A,partial){const n=A.length,out=[];if(n<5)return out;
  const g0=Math.ceil(A[0][0]/5)*5,g1=A[n-1][0];const G=[],H=[];let j=0;
  for(let t=g0;t<=g1;t+=5){while(j<n-2&&A[j+1][0]<t)j++;const a=A[j],b=A[j+1];if(!b){break;}
    const gap=b[0]-a[0];G.push(t);H.push(gap>300?NaN:a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(t-a[0])/(gap||1))));}
  const m=G.length,S=new Array(m).fill(NaN);
  for(let i=3;i<m-3;i++){let s=0,ok=true;for(let k=-3;k<=3;k++){const v=H[i+k];if(isNaN(v)){ok=false;break;}s+=v;}if(ok)S[i]=s/7;}
  const W=36;let last=null;
  for(let i=W;i<m-W;i++){const v=S[i];if(isNaN(v))continue;let mx=-1e9,mn=1e9,bad=false;
    for(let k=i-W;k<=i+W;k++){const x=S[k];if(isNaN(x)){bad=true;break;}if(x>mx)mx=x;if(x<mn)mn=x;}if(bad)continue;
    let k=null;if(v===mx&&v>mn+0.05)k='HW';else if(v===mn&&v<mx-0.05)k='LW';if(!k)continue;
    const t=G[i];if(last&&last.k===k&&t-last.t<180)continue;
    // raw plateau around the event
    let ri=-1,rv=k==='HW'?-1e9:1e9;for(let q=0;q<n;q++){if(Math.abs(A[q][0]-t)>90)continue;if((k==='HW'&&A[q][1]>rv)||(k==='LW'&&A[q][1]<rv)){rv=A[q][1];ri=q;}}
    if(ri<0)continue;const inP=x=>k==='HW'?x>=rv-0.015:x<=rv+0.015;let a=ri,b=ri;while(a>0&&inP(A[a-1][1])&&A[ri][0]-A[a-1][0]<240)a--;while(b<n-1&&inP(A[b+1][1])&&A[b+1][0]-A[ri][0]<360)b++;
    const ev={k,t,v:rv,s:A[a][0],e:b<n-1?A[b+1][0]:A[b][0],u:Math.max(5,(A[b][0]-A[a][0])/2+5)};out.push(ev);last=ev;
    if(partial&&k==='LW'){let fl=1e9;for(let q=0;q<n;q++)if(Math.abs(A[q][0]-t)<=36)fl=Math.min(fl,A[q][1]);
      let q=0;while(q<n&&A[q][0]<t)q++;while(q<n-1&&A[q][1]<=fl+0.03&&A[q][0]-t<480)q++;
      if(q>0&&q<n&&A[q][1]>fl+0.03&&A[q][0]-t<480){const gp=Math.min(A[q][0]-A[q-1][0],30);out.push({k:'RISE',t:A[q][0]-gp/2,v:fl,s:A[q-1][0],e:A[q][0],u:Math.max(5,gp/2)});}}}
  return out.sort((a,b)=>a.t-b.t);}
/* ---------- render ---------- */
function lastVal(arr,m){let lo=0,hi=arr.length-1,r=null;while(lo<=hi){const mid=(lo+hi)>>1;if(arr[mid][0]<=m){r=arr[mid];lo=mid+1;}else hi=mid-1;}return r;}
function fedNote(){if(!FT.twoNote)return;let el=$('gFed');if(!el){el=document.createElement('div');el.id='gFed';const lg=$('gLegend');if(lg)lg.before(el);else return;}
  let km=parseFloat(localStorage.getItem(FT.k('bt_km')));let line=localStorage.getItem(FT.k('bt_line'))||'M';if(!(km>=0)){km=BT.DEFKM;line='M';}if(!BT.NBY[line])line='M';
  const tn=FT.twoNote(km,line),fi=FT.fedInfo(km,line),NM=fi&&fi.nm||BT.TWONM;if(!tn){el.innerHTML='';return;}
  el.innerHTML=tn.replace('Fed from:','Fed from (Tides spot '+(line==='M'?'km '+km.toFixed(1):esc(BT.lineName(line)))+'):')+'<div class="mut" style="font-size:.8rem">Two entrances: '+esc(NM.sName)+' ('+esc(NM.sWord)+', '+esc(NM.sTide)+') and '+esc(NM.nName)+' ('+esc(NM.nWord)+', '+esc(NM.nTide)+'). '+esc(NM.gNote)+'</div>';}
function render(){latest();fedNote();statsTbl();events();draw();upd();document.body.dataset.gaugesReady='1';}
function upd(){if(!IDX||!IDX.fetched){$('gUpd').textContent='';return;}const gm=(Date.parse(IDX.fetched)-E0)/60000;
  $('gUpd').innerHTML=`Gauges fetched <b>${ago(gm)}</b> (${fDT(gm)})${fetchedFrom==='cache'?' · <b>offline copy</b>':''} · the site routine refreshes about every 3 h`;
  document.querySelectorAll('[data-ago]').forEach(el=>el.textContent=ago(+el.dataset.ago));}
function noGaugeNote(){return GA.length?'':`<div class="notice">📍 <b>No tidal gauge on ${esc(S.name)} — benchmark me.</b> The tide model here is ${S.confidence&&S.confidence.grade==='C'?'an uncalibrated generic estimate':'based on MSQ tide places / the reference port'} (grade ${esc(S.confidence?S.confidence.grade:'?')}). Log a high or low you see at a known spot in the Tides tab to calibrate it. The chart shows the reference port${PLACES.length?' and MSQ tide places':''} only.</div>`;}
function latest(){
  const card=(id,lab,unit,extra,off)=>{const a=rows(id).filter(r=>r[1]!=null);if(!a.length)return `<div class="gst"><small>${esc(lab)}</small><b>—</b><small>no recent data</small></div>`;
    const L=a[a.length-1];const p=lastVal(a.map(r=>[r[0],r[1]]),L[0]-60);const d=p?L[1]-p[1]:0;const ar=Math.abs(d)<0.005?'→':d>0?'↑':'↓';
    const stale=nowM()-L[0]>12*60;
    return `<div class="gst"><small>${esc(lab)}</small><b>${L[1].toFixed(2)} ${unit} ${ar}</b><small>${fT(L[0],{weekday:'short'})} · <span data-ago="${L[0]}">${ago(L[0])}</span>${stale?' ⚠':''}${extra?'<br>'+extra:''}</small></div>`;};
  let h='';
  for(const g of GA)h+=card(g.id,`${gname(g)} (${g.lineName&&g.line!=='M'?esc(g.lineName)+' ':''}${g.km.toFixed(1)} km)${g.role==='partial'?' · part-tidal':''}`,g.datum==='AHD'?'m AHD':'m',g.datum!=='AHD'&&OFF[g.id]?`gauge datum (${g.datum||'local'}); ≈ ${(rows(g.id).filter(r=>r[1]!=null).slice(-1)[0][1]-OFF[g.id]).toFixed(2)} m AHD`:'');
  if(REF)h+=card(REF.id,short(REF.name)+(REF.src==='des'?' (DES)':' (BoM tide)'),REF.datum==='AHD'?'m AHD':'m '+(REF.datum||''),REF.datum!=='AHD'?`≈ ${(((rows(REF.id).filter(r=>r[1]!=null).slice(-1)[0]||[0,0])[1])-REFOFF).toFixed(2)} m AHD (MSL-centred)`:'');
  if(FR)h+=card(FR.id,short(FR.name)+' (fresh-flow)','m','');
  const sc=FT.gSpots?FT.gSpots.cards():'';$('gLatest').innerHTML=(h+sc)||'<span class="mut">No gauge data yet.</span>';
  let f='';const M=ser.fresh||[];
  if(FR&&M.length){const L=M[M.length-1];const d24=lastVal(M,L[0]-1440),w=M.filter(x=>x[0]>=L[0]-7*1440);const mn=Math.min(...w.map(x=>x[1]));
    const rise24=d24?L[1]-d24[1]:0,above=L[1]-mn;const lvl=above>0.5||rise24>0.3?'bad':above>0.1||rise24>0.08?'warn':'ok';
    f=`<div class="notice ${lvl==='ok'?'info':lvl==='bad'?'err':''}">💧 <b>Fresh-flow &amp; tide-model reliability (${esc(short(FR.name))} ${esc(FR.id)}, above the tide):</b> ${L[1].toFixed(2)} m, ${rise24>=0?'+':''}${rise24.toFixed(2)} m in 24 h, ${above.toFixed(2)} m above its 7-day low. `+
      (lvl==='ok'?'Steady base flow — tide-driven gauge readings and the model are representative.':lvl==='warn'?'Rising — some fresh coming down: upper-reach lows sit higher and tides look smaller than the model.':'<b>Fresh / flood flow</b> — upper reaches are flow-dominated; tide timing and the model are unreliable there.')+'</div>';}
  $('gFresh').innerHTML=noGaugeNote()+f;
  if(FT.floodInfo){const el=$('gFresh');FT.floodInfo().then(h=>{if(h&&el.isConnected){const o=el.querySelector('.gflood');if(o)o.remove();el.insertAdjacentHTML('beforeend','<div class="gflood">'+h+'</div>');}}).catch(()=>{});}}
function statsTbl(){
  if(!GA.length){$('gStats').innerHTML='<tr><td class="mut">No tidal gauge on this system yet — nothing to compare the model with. Benchmarks you log in the Tides tab are used instead.</td></tr>';$('gStatsNote').textContent='';return;}
  const row=s=>{const a=s.all,w=s.last7d;const drift=a.n?a.mean-s.model:null;const cls=drift==null?'':Math.abs(drift)<15?'drift-ok':Math.abs(drift)<40?'drift-warn':'drift-bad';
    const flat=s.k==='LW'&&s.g.lowsFlat;const lab=gname(s.g)+' '+(s.k==='HW'?'HW':s.k==='RISE'?'water starts rising':flat?'low (flat lows)':'LW');
    if(flat)return `<tr><td>${esc(lab)}</td><td>${a.n||0}</td><td>${a.n?sg(a.mean):'—'}${a.sd!=null?' <span class="mut">±'+Math.round(a.sd)+'′</span>':''}</td><td>${w&&w.n?sg(w.mean)+' <span class="mut">(n '+w.n+')</span>':'—'}</td><td>${sg(s.model)} <span class="mut">interp.</span></td><td class="mut">n/a</td><td class="mut">±${a.u_med!=null?Math.round(a.u_med):'—'}′</td></tr>`;
    return `<tr><td>${esc(lab)}</td><td>${a.n||0}</td><td>${a.n?sg(a.mean):'—'}${a.sd!=null?' <span class="mut">±'+Math.round(a.sd)+'′</span>':''}</td><td>${w&&w.n?sg(w.mean)+' <span class="mut">(n '+w.n+')</span>':'—'}</td><td>${sg(s.model)}${s.est?' <span class="mut">est.</span>':''}</td><td class="${cls}">${drift==null?'—':(drift>=0?'+':'−')+Math.abs(Math.round(drift))+'′'}</td><td class="mut">±${a.u_med!=null?Math.round(a.u_med):'—'}′</td></tr>`;};
  $('gStats').innerHTML=`<tr><th>Lag after ${esc(PORT.name)} pred</th><th>n tides</th><th>Mean (loaded) ± sd</th><th>Last 7 d</th><th>App model</th><th>Drift</th><th>Gauge plateau ±</th></tr>`+Object.values(ST).map(row).join('');
  const first=Math.min(...GA.flatMap(g=>(EV[g.id]||[]).map(e=>e.bt)));
  $('gStatsNote').innerHTML=`Since ${isFinite(first)?fDT(first):'—'}${allLoaded?' (whole archive)':' (last ~5 weeks loaded; tap All for the whole archive)'}. Lag = gauge event − the ${esc(PORT.name)} predicted high/low the model shifts. Drift = mean − the lag the app's tide model uses at that gauge (green &lt;15′, amber &lt;40′, red ≥40′). A steady drift means the model needs re-calibrating; a jump during a fresh${FR?' (see '+esc(short(FR.name))+')':''} is expected.`;}
function events(){if(!GA.length){$('gEvents').innerHTML='';return;}const rs=[];
  for(const g of GA)for(const e of EV[g.id]||[])rs.push(Object.assign({},e,{lab:gname(g)+' '+(e.k==='RISE'?'starts rising':e.k==='LW'&&g.role==='partial'?'low plateau':e.k),off:OFF[g.id]||0}));
  rs.sort((a,b)=>b.t-a.t);
  $('gEvents').innerHTML=`<tr><th>Gauge event</th><th>Time (plateau)</th><th>Level</th><th>${esc(PORT.name)} pred</th><th>Lag</th></tr>`+rs.slice(0,40).map(e=>`<tr><td>${esc(e.lab)}</td><td>${fDT(e.t)}<br><span class="mut">${fT(e.s)}–${fT(e.e)}</span></td><td>${(e.v-e.off).toFixed(2)}</td><td class="mut">${fT(e.bt,{weekday:'short'})}<br>${(e.bh-Z0).toFixed(2)} AHD</td><td>${sg(e.lag)} <span class="mut">±${Math.round(e.u)}′</span><br><span class="mut">model ${sg(e.model)}</span></td></tr>`).join('');}
/* ---------- chart (same engine as the Baffle tab) ---------- */
function legend(){$('gLegend').innerHTML=SER.map(s=>`<button data-s="${s.id}" class="${on[s.id]?'':'off'}"><i style="background:${s.col}"></i>${esc(s.lab)}${s.g&&s.k==='step'&&s.g.datum!=='AHD'&&OFF[s.g.id]?' <span class="mut">('+(OFF[s.g.id]>=0?'−':'+')+Math.abs(OFF[s.g.id]).toFixed(2)+' m)</span>':''}</button>`).join('');
  $('gLegend').querySelectorAll('button').forEach(b=>b.onclick=()=>{on[b.dataset.s]=!on[b.dataset.s];try{localStorage.setItem(OKEY,JSON.stringify(on));}catch(e){}legend();draw();});}
function dataSpan(){let a=Infinity,b=-Infinity;for(const k of ['ref',...GA.map(g=>'g'+g.id)]){const s=ser[k];if(s&&s.length){a=Math.min(a,s[0][0]);b=Math.max(b,s[s.length-1][0]);}}
  if(!isFinite(a)){b=nowM();a=b-7*1440;}return[a,b];}
async function setRange(r,silent){if(r==='all'&&!allLoaded){await loadMonths(true);build();statsTbl();events();}
  const [a,b]=dataSpan();let end=Math.max(b,Math.min(nowM(),b+720))+180;const fe=FT.gSpots&&FT.gSpots.futureEnd();if(fe)end=Math.max(end,nowM()+36*60);
  view=r==='all'?[a-120,end]:[end-r*1440,end];
  document.querySelectorAll('.gbar [data-r]').forEach(x=>x.classList.toggle('on',String(x.dataset.r)===String(r)));if(!silent)draw();}
function clampView(){let [a,b]=dataSpan();const fe=FT.gSpots&&FT.gSpots.futureEnd();if(fe)b=Math.max(b,fe-1440);let w=view[1]-view[0];w=Math.max(180,Math.min(w,(b-a)+8*1440));let v0=view[0];v0=Math.max(a-7*1440,Math.min(v0,b+1440-w));view=[v0,v0+w];}
const mc={};
function model(s,v0,v1){const h0=Math.floor(v0/60/6)*6-12,h1=Math.ceil(v1/60/6)*6+12,key=s.id+':'+h0+':'+h1;if(mc[key])return mc[key];
  const span=h1-h0;if(span>24*120)return[];const st=Math.max(1/6,span/1200),out=[];
  if(s.fn==='port'){for(let h=h0;h<=h1;h+=st)out.push([h*60,BT.portH(h)-Z0]);}
  else{const P=BT.predictAt(s.km,h0,h1,{line:s.line});for(let h=h0;h<=h1;h+=st){const v=P.curve(h);if(v!=null)out.push([h*60,v]);}}
  return mc[key]=out;}
function thin(a,v0,v1,maxN){let i0=0;while(i0<a.length&&a[i0][0]<v0)i0++;i0=Math.max(0,i0-1);let i1=i0;while(i1<a.length&&a[i1][0]<=v1)i1++;i1=Math.min(a.length,i1+1);
  const s=a.slice(i0,i1);if(s.length<=maxN)return s;const bw=(v1-v0)/(maxN/2),out=[];let cur=null;
  for(const p of s){const b=Math.floor((p[0]-v0)/bw);if(!cur||cur.b!==b){if(cur){out.push(...(cur.mn[0]<cur.mx[0]?[cur.mn,cur.mx]:[cur.mx,cur.mn]));}cur={b,mn:p,mx:p};}else{if(p[1]<cur.mn[1])cur.mn=p;if(p[1]>cur.mx[1])cur.mx=p;}}
  if(cur)out.push(...(cur.mn[0]<cur.mx[0]?[cur.mn,cur.mx]:[cur.mx,cur.mn]));return out;}
let G=null;
function draw(){const svg=$('gChart');if(!view||!svg.parentNode.clientWidth)return;const W=Math.max(300,Math.round(svg.parentNode.clientWidth));
  for(const k in mc)if(Object.keys(mc).length>40)delete mc[k];
  clampView();const [v0,v1]=view;const fs=11;const SPL=FT.gSpots?FT.gSpots.prepare(v0,v1):[];const showLag=(GA.length&&on.lags)||(!GA.length&&SPL.length),showFr=FR&&on.fresh;const spLeg=FT.gSpots&&SPL.length?FT.gSpots.lagLegend(SPL):[];
  const L=36,R=8,pw=W-L-R;const H1=Math.round(Math.min(330,Math.max(220,W*0.62)));
  let y=8;const P1={y0:y,h:H1};y+=H1+22;const nL=(GA.length?GA.filter(g=>on['g'+g.id]).length*2:0)+spLeg.length;const legRows=pw>560?Math.ceil(nL/4):Math.ceil(nL/2);
  const P2=showLag?{y0:y,h:120}:null;if(P2)y+=120+16+legRows*13+8;
  const P3=showFr?{y0:y,h:56}:null;if(P3)y+=56+22;
  const Ht=y+18;svg.setAttribute('viewBox',`0 0 ${W} ${Ht}`);svg.style.height=Ht+'px';
  const X=m=>L+(m-v0)/(v1-v0)*pw;const maxN=Math.round(pw*1.5);
  const vis={};for(const s of SER){if(!on[s.id])continue;if(s.k==='line'||s.k==='step')vis[s.id]=thin(ser[s.id]||[],v0,v1,maxN);else if(s.k==='model')vis[s.id]=thin(model(s,v0,v1),v0,v1,maxN);}
  let lo=Infinity,hi=-Infinity;for(const k in vis)for(const p of vis[k])if(p[0]>=v0&&p[0]<=v1){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  for(const r of SPL)for(const p of r.pts)if(p[0]>=v0&&p[0]<=v1){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  if(!isFinite(lo)){lo=-1.5;hi=1.5;}const pad=(hi-lo)*0.06+(SPL.length?0.12:0.05);lo-=pad;hi+=pad;const Y1=v=>P1.y0+P1.h-(v-lo)/(hi-lo)*P1.h;
  let o='';const dayStart=Math.floor(v0/1440)*1440;
  for(let d=dayStart;d<v1;d+=1440){const n0=X(Math.max(v0,d+18.5*60)),n1=X(Math.min(v1,d+1440+5.3*60));if(n1>n0)o+=`<rect x="${n0}" y="${P1.y0}" width="${n1-n0}" height="${y-P1.y0-22}" fill="#000" opacity=".18"/>`;}
  const span=v1-v0;const tstep=span<=1.5*1440?180:span<=4*1440?720:span<=10*1440?1440:span<=40*1440?7*1440:30*1440;
  for(let t=Math.ceil(v0/tstep)*tstep;t<=v1;t+=tstep){const x=X(t);o+=`<line x1="${x}" x2="${x}" y1="${P1.y0}" y2="${y-22}" stroke="#25464b" stroke-width="1"/>`;
    const lab=tstep<1440?fT(t):fT(t,{hour:undefined,minute:undefined,hour12:undefined,weekday:'short',day:'numeric',month:tstep>=7*1440?'short':undefined});o+=`<text x="${x+3}" y="${Ht-5}" font-size="${fs}" fill="#9db5b1">${esc(lab)}</text>`;}
  const nx=X(nowM());if(nx>L&&nx<W-R)o+=`<line x1="${nx}" x2="${nx}" y1="${P1.y0}" y2="${y-22}" stroke="#f0a03a" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${nx-3}" y="${P1.y0+11}" text-anchor="end" font-size="${fs}" fill="#f0a03a">now</text>`;
  const yst=hi-lo>3?1:hi-lo>1.2?0.5:0.2;for(let v=Math.ceil(lo/yst)*yst;v<=hi;v+=yst){const yy=Y1(v);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#25464b" stroke-dasharray="2 4"/><text x="${L-4}" y="${yy+4}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${v.toFixed(1)}</text>`;}
  o+=`<text x="${L+4}" y="${P1.y0+12}" font-size="${fs}" fill="#9db5b1">≈ m AHD</text>`;
  o+=`<clipPath id="gc1"><rect x="${L}" y="${P1.y0}" width="${pw}" height="${P1.h}"/></clipPath><g clip-path="url(#gc1)">`;
  for(const s of SER){const a=vis[s.id];if(!a||!a.length)continue;let d='';
    if(s.k==='step'){let prev=null;a.forEach((p,i)=>{const xx=X(p[0]).toFixed(1),yy=Y1(p[1]).toFixed(1);d+=(!i||(prev&&p[0]-prev[0]>360))?`M${xx},${yy}`:`H${xx}V${yy}`;prev=p;});const last=a[a.length-1];d+=`H${Math.min(X(last[0]+30),W-R).toFixed(1)}`;}
    else{let pen=false,prev=null;for(const p of a){const brk=prev&&p[0]-prev[0]>(s.k==='model'?120:45);d+=(!pen||brk?'M':'L')+X(p[0]).toFixed(1)+','+Y1(p[1]).toFixed(1);pen=true;prev=p;}}
    o+=`<path d="${d}" fill="none" stroke="${s.col}" stroke-width="${s.k==='step'?2:1.5}" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/>`;
    if(s.dots&&a.length<300)o+=a.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y1(p[1]).toFixed(1)}" r="1.8" fill="${s.col}"/>`).join('');
    if(s.k==='step'&&s.g)for(const e of EV[s.g.id]||[])if(e.k==='HW'&&e.t>v0&&e.t<v1){const xx=X(e.t),yy=Y1(e.v-(OFF[s.g.id]||0));o+=`<path d="M${xx},${yy-6}l-4,-8h8z" fill="${s.col}"/>`;}}
  if(SPL.length)o+=FT.gSpots.svgMain(SPL,X,Y1,v0,v1);
  if(FT.cross)o+=FT.cross.gaugeSvg({X,Y1,v0,v1,P1,redraw:draw,gauges:SER.filter(s=>s.k==='step'&&s.g&&on[s.id]).map(s=>({km:s.g.km,line:s.g.line,name:s.g.name,short:gname(s.g)}))});
  o+='</g>';
  if(P2){const LG=[];if(GA.length&&on.lags)GA.forEach((g,i)=>{if(!on['g'+g.id])return;LG.push({g,k:'HW',col:PAL[i%PAL.length],lab:gname(g)+' HW'});LG.push({g,k:g.role==='partial'?'RISE':'LW',col:MPAL[i%MPAL.length],lab:gname(g)+(g.role==='partial'?' rise':' LW')});});
    const pts=[];for(const Lg of LG)for(const e of EV[Lg.g.id]||[])if(e.k===Lg.k&&e.bt>=v0-600&&e.bt<=v1)pts.push(Object.assign({},e,{col:Lg.col}));
    const spp=SPL.length?FT.gSpots.lagPts(SPL,v0,v1):[];
    let a=Infinity,b=-Infinity;for(const p of pts.concat(spp)){a=Math.min(a,p.lag-p.u);b=Math.max(b,p.lag+p.u);}for(const Lg of LG){const m=ST[Lg.g.id+'_'+Lg.k];if(m){a=Math.min(a,m.model);b=Math.max(b,m.model);}}
    if(!isFinite(a)){a=0;b=240;}a=Math.floor((a-20)/60)*60;b=Math.ceil((b+20)/60)*60;if(b-a<120)b=a+120;
    const Y2=v=>P2.y0+P2.h-(v-a)/(b-a)*P2.h;
    o+=`<rect x="${L}" y="${P2.y0}" width="${pw}" height="${P2.h}" fill="none" stroke="#25464b"/>`;
    const st2=(b-a)>480?120:60;for(let v=a;v<=b;v+=st2){const yy=Y2(v);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#25464b" stroke-dasharray="2 4"/><text x="${L-4}" y="${yy+4}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${v<0?'−':''}${Math.abs(v)/60}h</text>`;}
    for(const Lg of LG){const m=ST[Lg.g.id+'_'+Lg.k];if(!m)continue;const yy=Y2(m.model);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${Lg.col}" stroke-dasharray="${Lg.k==='HW'?'6 3':'2 3'}" opacity=".75"/>`;}
    o+=`<text x="${L+4}" y="${P2.y0+12}" font-size="${fs}" fill="#9db5b1">lag after ${esc(PORT.name)} pred (${LG.length?'dashed = app model':''}${LG.length&&spp.length?'; ':''}${spp.length?'hollow = spots (pred)':''})</text>`;
    o+=`<clipPath id="gc2"><rect x="${L}" y="${P2.y0}" width="${pw}" height="${P2.h}"/></clipPath><g clip-path="url(#gc2)">`;
    for(const p of pts){const xx=X(p.bt).toFixed(1);o+=`<line x1="${xx}" x2="${xx}" y1="${Y2(p.lag-p.u)}" y2="${Y2(p.lag+p.u)}" stroke="${p.col}" stroke-width="1.2" opacity=".7"/><circle cx="${xx}" cy="${Y2(p.lag)}" r="3.2" fill="${p.col}"/>`;}
    if(spp.length)o+=FT.gSpots.lagSvg(spp,X,Y2);
    o+='</g>';const per=pw>560?4:2,cw=pw/per;const LL=LG.concat(spLeg);
    o+=LL.map((Lg,i)=>{const cx=L+8+(i%per)*cw,cy=P2.y0+P2.h+12+Math.floor(i/per)*13;const mk=Lg.hollow==='c'?`<circle cx="${cx}" cy="${cy-4}" r="3.3" fill="#0f2427" stroke="${Lg.col}" stroke-width="1.5"/>`:Lg.hollow==='s'?`<rect x="${cx-3.2}" y="${cy-7.2}" width="6.4" height="6.4" fill="#0f2427" stroke="${Lg.col}" stroke-width="1.5"/>`:`<circle cx="${cx}" cy="${cy-4}" r="3.5" fill="${Lg.col}"/>`;return mk+`<text x="${cx+7}" y="${cy}" font-size="${fs}" fill="#cfe">${esc((n=>Lg.lab.length>n?Lg.lab.slice(0,n-1)+'…':Lg.lab)(Math.max(12,Math.floor((cw-16)/6.2))))}</text>`;}).join('');}
  if(P3){const a=thin(ser.fresh||[],v0,v1,maxN);let mn=Infinity,mx=-Infinity;for(const p of a){mn=Math.min(mn,p[1]);mx=Math.max(mx,p[1]);}
    if(!isFinite(mn)){mn=0;mx=1;}if(mx-mn<0.2){const c=(mx+mn)/2;mn=c-0.1;mx=c+0.1;}
    const Y3=v=>P3.y0+P3.h-(v-mn)/(mx-mn)*P3.h;o+=`<rect x="${L}" y="${P3.y0}" width="${pw}" height="${P3.h}" fill="none" stroke="#25464b"/>`;
    o+=`<text x="${L-4}" y="${P3.y0+10}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${mx.toFixed(2)}</text><text x="${L-4}" y="${P3.y0+P3.h}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${mn.toFixed(2)}</text>`;
    let d='';a.forEach((p,i)=>{d+=(i?'L':'M')+X(p[0]).toFixed(1)+','+Y3(p[1]).toFixed(1);});
    o+=`<clipPath id="gc3"><rect x="${L}" y="${P3.y0}" width="${pw}" height="${P3.h}"/></clipPath><path clip-path="url(#gc3)" d="${d}" fill="none" stroke="#b48cff" stroke-width="1.8"/><text x="${L+4}" y="${P3.y0+12}" font-size="${fs}" fill="#9db5b1">${esc(short(FR.name))} ${esc(FR.id)} (m) — fresh-flow indicator</text>`;}
  o+=`<g id="gCur"></g>`;svg.innerHTML=o;G={X,v0,v1,L,pw,W,Ht,vis,Y1,P1,SPL};}
/* ---------- interaction ---------- */
const ptrs=new Map();let drag=null;
function tip(clientX){if(!G)return;const svg=$('gChart'),rc=svg.getBoundingClientRect();const sx=(clientX-rc.left)*(G.W/rc.width);if(sx<G.L||sx>G.L+G.pw){$('gTip').style.display='none';$('gCur').innerHTML='';return;}
  const m=G.v0+(sx-G.L)/G.pw*(G.v1-G.v0);let rs=[];
  for(const s of SER){if(!on[s.id]||s.k==='panel')continue;let v=null;
    if(s.k==='step'){const p=lastVal(ser[s.id]||[],m);v=p&&m-p[0]<720?p[1]:null;}
    else{const a=s.k==='model'?(G.vis[s.id]||[]):ser[s.id]||[];let i=0;while(i<a.length&&a[i][0]<m)i++;if(i>0&&i<a.length&&a[i][0]-a[i-1][0]<180){const f=(m-a[i-1][0])/(a[i][0]-a[i-1][0]);v=a[i-1][1]+f*(a[i][1]-a[i-1][1]);}}
    if(v!=null)rs.push(`<span style="color:${s.col}">●</span> ${esc(s.lab)}: <b>${v.toFixed(2)}</b>`);}
  if(FR&&on.fresh){const p=lastVal(ser.fresh||[],m);if(p)rs.push(`<span style="color:#b48cff">●</span> ${esc(short(FR.name))}: <b>${p[1].toFixed(2)}</b>`);}
  if(G.SPL&&G.SPL.length)rs.push(...FT.gSpots.tipRows(G.SPL,m,Math.max(20,(G.v1-G.v0)/G.pw*14)));
  const tp=$('gTip');tp.innerHTML=`<b>${fDT(m)}</b><br>`+rs.join('<br>');tp.style.display='block';
  const wx=svg.parentNode.clientWidth;const px=(sx/G.W)*rc.width;tp.style.left=Math.max(0,Math.min(px+10,wx-tp.offsetWidth-2))+'px';tp.style.top='30px';
  $('gCur').innerHTML=`<line x1="${sx}" x2="${sx}" y1="${G.P1.y0}" y2="${G.Ht-18}" stroke="#fff" stroke-width="1" opacity=".6"/>`;}
function zoom(f,cx){if(!view)return;const c=cx!=null?cx:(view[0]+view[1])/2;view=[c-(c-view[0])*f,c+(view[1]-c)*f];document.querySelectorAll('.gbar [data-r]').forEach(x=>x.classList.remove('on'));draw();}
function svgX(e){const rc=$('gChart').getBoundingClientRect();return (e.clientX-rc.left)*(G.W/rc.width);}
function mAt(e){return G.v0+(svgX(e)-G.L)/G.pw*(G.v1-G.v0);}
function bind(){const svg=$('gChart');
  svg.addEventListener('pointerdown',e=>{if(!view)return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);
    if(ptrs.size===1)drag={x0:e.clientX,v:view.slice(),moved:false};
    else if(ptrs.size===2&&G){const [a,b]=[...ptrs.values()];drag={pinch:Math.abs(a.x-b.x)||1,v:view.slice(),cm:mAt({clientX:(a.x+b.x)/2}),moved:true};}});
  svg.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId)){if(e.pointerType==='mouse')tip(e.clientX);return;}ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!drag||!G)return;
    if(drag.pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const f=drag.pinch/(Math.abs(a.x-b.x)||1);const c=drag.cm;view=[c-(c-drag.v[0])*f,c+(drag.v[1]-c)*f];draw();return;}
    const dx=e.clientX-drag.x0;if(Math.abs(dx)>6)drag.moved=true;if(!drag.moved)return;
    const rc=svg.getBoundingClientRect();const dm=-dx/(rc.width*G.pw/G.W)*(drag.v[1]-drag.v[0]);view=[drag.v[0]+dm,drag.v[1]+dm];
    document.querySelectorAll('.gbar [data-r]').forEach(x=>x.classList.remove('on'));draw();});
  const up=e=>{const wasTap=drag&&!drag.moved&&ptrs.size===1;ptrs.delete(e.pointerId);if(wasTap)tip(e.clientX);if(!ptrs.size)drag=null;};
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);if(!ptrs.size)drag=null;});
  svg.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){$('gTip').style.display='none';const c=$('gCur');if(c)c.innerHTML='';}});
  svg.addEventListener('wheel',e=>{if(!G)return;e.preventDefault();zoom(e.deltaY>0?1.2:1/1.2,mAt(e));},{passive:false});
  document.querySelectorAll('.gbar [data-r]').forEach(b=>b.onclick=()=>setRange(b.dataset.r==='all'?'all':+b.dataset.r));
  $('gZi').onclick=()=>zoom(1/1.5);$('gZo').onclick=()=>zoom(1.5);$('gRefresh').onclick=()=>load(true);
  let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(shown)draw();},150);});}
legend();bind();
if(FT.gSpots){FT.gSpots.ui();FT.gSpots.setOnChange(()=>{if(!view)return;const fe=FT.gSpots.futureEnd();if(fe&&view[1]<nowM()+20*60){const w=view[1]-view[0];view=[nowM()+36*60-w,nowM()+36*60];}latest();draw();});}
FT.onTab=FT.onTab||[];FT.onTab.push(t=>{shown=t==='gauges';if(shown){if(!IDX)load(true).then(legend);else{load(false);draw();}}});
setInterval(()=>{if(document.visibilityState==='visible'&&shown)load(true);},10*60e3);
setInterval(()=>{if(shown)upd();},30e3);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&shown)load(false);});
FT.gaugesReload=()=>load(true);
window.__FT_GAUGES=()=>({IDX,view,EV,ST,OFF,ser,SER:SER.map(s=>s.id)});
if(document.getElementById('tab-gauges')&&!document.getElementById('tab-gauges').hidden){shown=true;load(true).then(legend);}
})();
