/* ===== Calendar tab (#cal): month grid of the best bite score per day for this river system =====
   Scores come from the Bite tab's own scoring code (MJ.computeDay + the system's tide model + spot types + flood cycle +
   Baffle single-high stands) run in a Web Worker built from this page's own script texts (main-thread fallback).
   Month grid = fast 30-min scan (sun/moon events shared per ~5 km cell); tapping a day re-scores the best spots at 15 min
   exactly as Bite times does. Forecast weather/SST for the next ~16 days, outlook (neutral weather, seasonal water temp)
   beyond. Results cached in IndexedDB per system/scope keyed by build + spots + settings. Spots never leave the phone:
   weather is fetched for a fixed point on the main channel (or a built-in landmark), never for your own spots. */
(function(){'use strict';
const FT=window.FT,B=window.BT,MJ=window.MJ,C=window.FTCalc;if(!FT||!B||!MJ||!C||!document.getElementById('calGrid'))return;
const $=id=>document.getElementById(id),TZ=C.TZ,HR=36e5,DAY=864e5,GEN=!!B.generic,SYS=FT.SYS||'baffle';
const VER=(document.querySelector('meta[name="app-version"]')||{}).content||'dev';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const lerp=(x,a,b,c,d)=>c+(d-c)*Math.max(0,Math.min(1,(x-a)/(b-a)));
const hue=s=>s<50?lerp(s,0,50,210,45):lerp(s,50,100,45,135);
const scoreColor=s=>FTRamp(s),heat=s=>FTRamp(s);
const dtf=new Intl.DateTimeFormat('en-AU',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true});
const fmtT=ms=>dtf.format(new Date(ms)).replace(/\s?([ap])\.?m\.?/i,(m,a)=>a.toLowerCase()+'m');
const fmtS=ms=>fmtT(ms).replace(/m$/,'');
const fmtDay=(ds,o)=>{const [y,m,d]=ds.split('-').map(Number);return new Intl.DateTimeFormat('en-AU',Object.assign({timeZone:'UTC',weekday:'short',day:'numeric',month:'short'},o||{})).format(new Date(Date.UTC(y,m-1,d)));};
const dow=ds=>{const [y,m,d]=ds.split('-').map(Number);return (new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;}; /* Mon=0 */
const SFX=' — '+(GEN?FT.SYSSHORT:'Baffle Ck');
const KEY=FT.k('ft_cal'),KWX=FT.k('ft_cal_wx'),KSST=FT.k('ft_cal_sst');
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
let set=Object.assign({scope:'sys',dd:false,min:0,wk:true,view:'grid'},ld(KEY,{}));
const today=()=>MJ.ymd(Date.now(),TZ);
const NDAYS=366;
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
const STG={ri:['RI','#ffd21f','run-in'],tot:['TOT','#3ddc84','top of tide'],bot:['BOT','#a46bff','bottom of tide'],ro:['RO','#ff4fa3','run-out'],stand:['STAND','#9db5b1','tide stand']};
let st={inited:false,month:null,pts:[],data:{},base:'',gen:0,worker:null,runner:null,cfg:null,core:null,need:0,doneDays:0,t0:0,perf:null,mode:'',busy:false,prog:null,sheet:null};
/* ---------- points ---------- */
const S=FT.spots;
const lineList=()=>S&&S.channels?S.channels().map(c=>({id:c.id,a:c.min,b:c.max,main:c.main,est:c.est})):GEN?B.LINES.map(L=>({id:L.id,a:L.id==='M'?0:L.j,b:B.lineMax(L.id),main:L.id==='M'}))
  :[{id:'B',a:0,b:B.MAXKM,main:true},{id:'E',a:window.BAFFLE_DATA.euleilahJunctionKm,b:S?S.EUMAX:B.MAXKM,main:false}];
const pAt=(km,line)=>S?S.pointAt(km,line):(GEN?B.pointOnLine(km,line||'M'):B.pointAtKm(km));
const lineShort=id=>S?S.lineLabel(id,false):(GEN?B.lineName(id):'Baffle Ck');
const isMainLine=id=>GEN?id==='M':(id||'B')==='B';
function lmPt(l){const p=S?S.latLng(l):pAt(l.km,l.line);return{id:l.id||null,name:l.name,km:+l.km,line:GEN?(l.line||'M'):(l.line||'B'),lat:p[0],lng:p[1],type:l.custom&&MJ.STYPES&&MJ.STYPES[l.type]?l.type:'',depth:l.custom&&l.depth?l.depth:'',custom:!!l.custom,lm:true};}
function scanPts(){const out=[];
  for(const L of lineList()){const len=L.b-L.a;if(len<0.3)continue;const ks=[];
    if(L.main){const step=len<=30?1.5:2;for(let km=Math.min(0.5,len/2);km<=L.b+1e-6;km+=step)ks.push(km);if(L.b-ks[ks.length-1]>0.6)ks.push(L.b);}
    else{const n=L.est?(len<5?1:2):len<1.5?1:Math.min(6,Math.floor((len-0.5)/2)+1);for(let i=0;i<n;i++)ks.push(Math.min(L.b,n===1?L.a+len/2:L.a+1+i*Math.min(2,(len-1)/Math.max(1,n-1))));}
    for(const k of ks){const km=+k.toFixed(2),q=pAt(km,L.id);out.push({km,line:L.id,name:(!L.main&&S&&S.alongLabel&&S.alongLabel(km,L.id))||('km '+km.toFixed(1)+(L.main?'':' · '+lineShort(L.id))),lat:q[0],lng:q[1],type:'',custom:false,id:null});}}
  const LM=S?S.all():B.LANDMARKS;
  for(const l of LM){if(l.custom||l.est)continue;const ln=GEN?(l.line||'M'):(l.line||'B');let best=null;
    for(const p of out)if(!p.lm&&p.line===ln){const d=Math.abs(p.km-l.km);if(d<=0.75&&(!best||d<best.d))best={p,d};}
    if(best)Object.assign(best.p,lmPt(l));else out.push(lmPt(l));}
  for(const l of LM)if(l.custom)out.push(lmPt(l));
  return out.sort((a,b)=>(isMainLine(a.line)?0:1)-(isMainLine(b.line)?0:1)||String(a.line).localeCompare(String(b.line))||a.km-b.km);}
function ptsFor(scope){if(scope==='sys')return scanPts();const cs=S?S.customs():[];
  if(scope==='mine')return cs.map(lmPt);
  const l=S?S.get(scope.slice(3)):null;return l?[lmPt(l)]:[];}
const ptLabel=p=>`${p.custom?'★ ':''}${esc(p.name)}${p.lm||!/^km /.test(p.name)?` <small class="mut">km ${p.km.toFixed(1)}${isMainLine(p.line)?'':' '+esc(lineShort(p.line))}</small>`:''}`;
/* ---------- weather / SST (same Open-Meteo requests as Bite times, for one fixed public point) ---------- */
const WXH='pressure_msl,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,relative_humidity_2m,temperature_2m,weather_code,cape,lifted_index';
async function getJ(url,key){
  try{const r=await fetch(url);const j=await r.json();
    if(j.error){const m=/to (\d{4}-\d\d-\d\d)/.exec(j.reason||'');if(m&&/end_date/.test(j.reason)&&!/clamped/.test(url))return getJ(url.replace(/end_date=[\d-]+/,'end_date='+m[1])+'&clamped=1',key);throw new Error(j.reason||'API error');}
    sv(key,{u:url.split('&start_date')[0],j,at:Date.now()});return j;}
  catch(e){const c=ld(key,null);if(c&&c.u===url.split('&start_date')[0]){c.j._cached=c.at;return c.j;}return null;}}
function refPoint(scope){if(scope&&scope.startsWith('lm:')){const l=S&&S.get(scope.slice(3));if(l&&!l.custom){const p=S.latLng(l);return{lat:p[0],lng:p[1],name:l.name};}}
  const km=(GEN?B.lineMax('M'):B.MAXKM)*0.4,p=pAt(km,GEN?'M':'B');return{lat:p[0],lng:p[1],name:'km '+km.toFixed(1)+' '+(GEN?FT.SYSSHORT:'Baffle Ck')};}
async function buildCfg(scope){const opts=Object.assign({},FT.baffleOpts?FT.baffleOpts():{});delete opts.line;
  const ref=refPoint(scope),t=today(),ll=`latitude=${ref.lat.toFixed(4)}&longitude=${ref.lng.toFixed(4)}`,a=MJ.addDays(t,-1),b=MJ.addDays(t,15);
  const [fc,mr,fresh]=await Promise.all([
    getJ(`https://api.open-meteo.com/v1/forecast?${ll}&hourly=${WXH}&timezone=auto&wind_speed_unit=kmh&start_date=${a}&end_date=${b}`,KWX),
    getJ(`https://marine-api.open-meteo.com/v1/marine?${ll}&hourly=sea_level_height_msl,sea_surface_temperature&timezone=auto&start_date=${a}&end_date=${b}&cell_selection=sea`,KSST),
    FT.getFresh?FT.getFresh().catch(()=>null):Promise.resolve(null)]);
  let wx=null,sst=null,wxKey=null,wxInfo={ok:false};
  if(fc&&fc.hourly&&fc.hourly.time){const tz=fc.timezone||TZ,tt=fc.hourly.time.map(s=>MJ.parseLocalIso(s,tz));const h={};for(const k of WXH.split(','))if(Array.isArray(fc.hourly[k]))h[k]=fc.hourly[k];
    wx={tt,h};wxKey=hash(JSON.stringify([tt[0],tt.length,h.pressure_msl,h.precipitation,h.cloud_cover]));wxInfo={ok:true,cached:fc._cached||0,to:tt[tt.length-1]};}
  if(mr&&mr.hourly&&mr.hourly.sea_surface_temperature&&mr.hourly.sea_surface_temperature.some(v=>v!=null)){const tz=mr.timezone||TZ;sst={tt:mr.hourly.time.map(s=>MJ.parseLocalIso(s,tz)),v:mr.hourly.sea_surface_temperature};}
  const fr=fresh?JSON.parse(JSON.stringify(fresh)):null;
  return{opts,wx,sst,fresh:fr,sys:GEN?B.SYS:null,ref,wxKey,wxInfo,freshKey:fr?[fr.kind,fr.peakT||0,fr.onsetT||0].join(':'):'-'};}
/* ---------- IndexedDB cache ---------- */
const IDB={p:null,open(){if(!this.p)this.p=new Promise(res=>{try{if(!window.indexedDB)return res(null);const r=indexedDB.open('ft-cal',1);r.onupgradeneeded=()=>{try{r.result.createObjectStore('d');}catch(e){}};r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);r.onblocked=()=>res(null);}catch(e){res(null);}});return this.p;},
  async all(base){const db=await this.open();if(!db)return{};return new Promise(res=>{const out={};try{const rq=db.transaction('d','readonly').objectStore('d').openCursor(IDBKeyRange.bound(base+'#',base+'#\uffff'));
    rq.onsuccess=()=>{const c=rq.result;if(c){out[String(c.key).slice(base.length+1)]=c.value;c.continue();}else res(out);};rq.onerror=()=>res(out);}catch(e){res(out);}});},
  async put(base,days){const db=await this.open();if(!db)return;try{const s=db.transaction('d','readwrite').objectStore('d');for(const d in days)s.put(days[d],base+'#'+d);}catch(e){}},
  async prune(prefix,keep,before){const db=await this.open();if(!db)return;try{const s=db.transaction('d','readwrite').objectStore('d');const rq=s.openCursor(IDBKeyRange.bound(prefix,prefix+'\uffff'));
    rq.onsuccess=()=>{const c=rq.result;if(!c)return;const k=String(c.key);const d=k.slice(k.indexOf('#')+1);if(!k.startsWith(keep+'#')||d<before)c.delete();c.continue();};}catch(e){}}};
/* ---------- compute orchestration ---------- */
const monthKey=ds=>ds.slice(0,7);
function allDays(){const t=today(),o=[];for(let i=0;i<NDAYS;i++)o.push(MJ.addDays(t,i));return o;}
function stopWork(){if(st.worker){try{st.worker.terminate();}catch(e){}st.worker=null;}if(st.runner){st.runner.stop();st.runner=null;}}
function workerSrc(){return ['mj-core','bt-data','bt-core','bt-runin','bt-sides','ft-engine','ft-calc'].map(id=>{const s=document.getElementById(id);if(!s)throw new Error('no '+id);return s.textContent;}).join('\n;\n');}
let WURL=null;
function onMsg(m){if(m.gen!==st.gen)return;
  if(m.type==='prog'){st.prog=m;showProg();}
  else if(m.type==='block'){for(const d in m.days){m.days[d].wk=m.days[d].fc?st.cfg.wxKey:null;st.data[d]=m.days[d];}st.doneDays+=Object.keys(m.days).length;
    st.perf.blocks.push({key:m.key,ms:m.ms,days:Object.keys(m.days).length,n:m.n});IDB.put(st.base,m.days);
    if(set.view==='list'||m.key===st.month)render();else if(m.key<=monthKey(MJ.addDays(st.month+'-01',40)))render();showProg();}
  else if(m.type==='idle'){st.busy=false;st.perf.totalMs=Date.now()-st.t0;st.prog=null;showProg();render();document.body.dataset.calDone=String(st.gen);}
  else if(m.type==='error'){console.warn('cal worker',m.msg);fallback();}
  else if(m.type==='ready'){st.worker.postMessage({type:'add',gen:st.gen,blocks:st.blocks});}}
function fallback(){stopWork();st.mode='main thread';st.runner=C.makeRunner(st.core,st.pts,x=>{x.gen=st.gen;setTimeout(()=>onMsg(x),0);});st.runner.add(st.blocks);showProg();}
async function start(){stopWork();const g=++st.gen;st.busy=true;st.data={};st.prog=null;showProg('Preparing…');
  st.pts=ptsFor(set.scope);document.body.dataset.calDone='';
  if(!st.pts.length){st.busy=false;showProg();render();return;}
  const cfg=await buildCfg(set.scope);if(g!==st.gen)return;st.cfg=cfg;
  st.core=C.makeCore(B,MJ,cfg);
  const pre=`${SYS}|${set.scope}|`;st.base=pre+hash(VER+JSON.stringify(st.pts.map(p=>[p.km,p.line,p.type,+p.lat.toFixed(5),+p.lng.toFixed(5)]))+JSON.stringify(cfg.opts)+cfg.freshKey);
  const cached=await IDB.all(st.base);if(g!==st.gen)return;IDB.prune(pre,st.base,today());
  const need={};
  for(const d of allDays()){const c=cached[d],fcNow=st.core.fcOf(d);
    if(c&&Array.isArray(c.p)&&c.p.length===st.pts.length&&(c.fc?(!fcNow||c.wk===cfg.wxKey):!fcNow))st.data[d]=c;else(need[monthKey(d)]=need[monthKey(d)]||[]).push(d);}
  const keys=Object.keys(need).sort();const vis=st.month;keys.sort((a,b)=>(a===vis?-1:b===vis?1:0)||a.localeCompare(b));
  st.blocks=keys.map(k=>({key:k,dates:need[k]}));st.need=st.blocks.reduce((a,b)=>a+b.dates.length,0);st.doneDays=0;st.t0=Date.now();
  st.perf={pts:st.pts.length,days:st.need,cached:Object.keys(st.data).length,blocks:[],mode:'',scope:set.scope};
  render();
  if(!st.blocks.length){st.busy=false;st.perf.totalMs=0;showProg();document.body.dataset.calDone=String(g);return;}
  let w=null;try{if(!window.Worker||FT.calNoWorker||/[?&]calmain=1\b/.test(location.search))throw 0;if(!WURL)WURL=URL.createObjectURL(new Blob(['self.window=self;self.FT={};self.__ftCalWorker=1;\n'+workerSrc()],{type:'text/javascript'}));w=new Worker(WURL);}catch(e){w=null;}
  if(w){st.worker=w;st.mode='Web Worker';w.onmessage=e=>onMsg(e.data);w.onerror=e=>{console.warn('cal worker error',e.message);if(g===st.gen)fallback();};
    w.postMessage({type:'init',gen:g,pts:st.pts,cfg:{opts:cfg.opts,wx:cfg.wx,sst:cfg.sst,fresh:cfg.fresh,sys:cfg.sys}});}
  else fallback();
  st.perf.mode=st.mode;showProg();}
function showProg(txt){const el=$('calProg');if(!el)return;
  if(txt){el.hidden=false;el.querySelector('span').textContent=txt;el.querySelector('i').style.width='3%';return;}
  if(!st.busy){const P=st.perf;if(P&&P.totalMs&&st.need){el.hidden=false;el.querySelector('i').style.width='100%';el.querySelector('span').textContent=`✓ ${st.need} days × ${P.pts} spot${P.pts>1?'s':''} scored in ${(P.totalMs/1000).toFixed(1)} s (${st.mode}); cached on this phone`;}else el.hidden=true;return;}
  const p=st.prog,frac=st.need?(st.doneDays+(p?p.i/p.n*((st.blocks.find(b=>b.key===p.key)||{dates:[]}).dates.length):0))/st.need:0;
  el.hidden=false;el.querySelector('i').style.width=Math.max(3,Math.round(frac*100))+'%';
  el.querySelector('span').textContent=p?`Scoring ${monthName(p.key)} · spot ${p.i}/${p.n} · ${Math.round(frac*100)}% of ${st.need} days (${st.mode})`:`Starting (${st.mode||'…'})…`;}
const monthName=k=>{const [y,m]=k.split('-').map(Number);return new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(Date.UTC(y,m-1,1)));};
/* ---------- rendering ---------- */
const moonC={};function moonOf(ds){if(!moonC[ds]){const t=MJ.dayStart(ds,TZ)+12*HR,il=MJ.moonIllum(t);moonC[ds]={e:MJ.phaseEmoji(il.phase,-25),n:MJ.phaseName(il.phase),f:il.fraction};}return moonC[ds];}
function cellVal(ds){const r=st.data[ds];if(!r||!r.p)return null;const o=set.dd?2:0;let s=-1,i=-1,m=0;r.p.forEach((a,k)=>{if(a&&a[o]>s){s=a[o];i=k;m=a[o+1];}});return s<0?null:{s,i,t:MJ.dayStart(ds,TZ)+m*6e4,fc:r.fc};}
function months(){const t=today(),o=[];let [y,m]=t.split('-').map(Number);for(let i=0;i<13;i++){o.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m>12){m=1;y++;}}return o;}
function render(){if(!st.inited)return;const M=months();if(!M.includes(st.month))st.month=M[0];
  $('calMonth').textContent=new Intl.DateTimeFormat('en-AU',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(+st.month.slice(0,4),+st.month.slice(5,7)-1,1)));
  $('calPrev').disabled=st.month===M[0];$('calNext').disabled=st.month===M[M.length-1];
  document.querySelectorAll('#calViewSeg button').forEach(b=>b.classList.toggle('on',b.dataset.v===set.view));
  $('calGridWrap').hidden=set.view!=='grid';$('calList').hidden=set.view!=='list';
  if(!st.pts.length){const msg=set.scope==='mine'?'You have no spots on this system yet — add some on the 🗺️ Map tab (long-press near the creek) and give them a type.':'No spots to score.';
    $('calGrid').innerHTML=`<p class="mut" style="grid-column:1/-1">${msg}</p>`;$('calList').innerHTML='';renderLegend();return;}
  if(set.view==='grid')renderGrid();else renderList();renderLegend();}
function renderGrid(){const t=today(),first=st.month+'-01',off=dow(first),end=MJ.addDays(t,NDAYS-1);const h=[];
  for(let i=0;i<off;i++)h.push('<span class="cc blank"></span>');
  for(let d=first;d.slice(0,7)===st.month;d=MJ.addDays(d,1)){const dn=+d.slice(8),wk=set.wk&&dow(d)>=5;
    if(d<t||d>end){h.push(`<span class="cc past${wk?' wk':''}"><span class="cn">${dn}</span></span>`);continue;}
    const v=cellVal(d),mo=moonOf(d);
    if(!v){h.push(`<button class="cc${wk?' wk':''}${d===t?' today':''}" data-d="${d}" aria-label="${fmtDay(d)}: computing"><span class="cn">${dn}</span><span class="cm">${mo.e}</span><span class="spin" style="width:10px;height:10px"></span></button>`);continue;}
    const dim=v.s<set.min;
    h.push(`<button class="cc${wk?' wk':''}${dim?' dim':''}${d===t?' today':''}" data-d="${d}" style="background:${heat(v.s)};color:${FTRamp.ink(v.s)}" aria-label="${fmtDay(d)}: best ${v.s} at ${fmtT(v.t)}${v.fc?' (forecast)':''}"><span class="cn">${dn}</span><span class="cm">${mo.e}</span><b class="cs">${v.s}</b><span class="ct">${fmtS(v.t)}</span>${v.s>=90?'<i class="cb">★</i>':''}${v.fc?'<span class="cf" title="weather forecast"></span>':''}</button>`);}
  $('calGrid').innerHTML=h.join('');}
function bestDays(range){const t=today(),o=[];for(const d of allDays()){if(range==='month'&&d.slice(0,7)!==st.month)continue;const v=cellVal(d);if(v&&v.s>=set.min)o.push({d,v});}return o.sort((a,b)=>b.v.s-a.v.s||a.d.localeCompare(b.d)).slice(0,10);}
function renderList(){const rg=set.range||'month';const L=bestDays(rg);const nd=allDays().filter(d=>(rg!=='month'||d.slice(0,7)===st.month)&&!st.data[d]).length;
  $('calList').innerHTML=`<div class="row" style="margin-bottom:6px"><div class="mseg" id="calRange"><button data-r="month" class="${rg==='month'?'on':''}">This month</button><button data-r="season" class="${rg==='season'?'on':''}">Next 12 months</button></div>${nd?`<span class="mut" style="font-size:.78rem">${nd} days still computing…</span>`:''}</div>`+
    (L.length?`<div class="cbl">${L.map((x,k)=>{const p=st.pts[x.v.i]||{};const wk=dow(x.d)>=5;return `<button class="cbr" data-d="${x.d}"><span class="mut" style="width:14px">${k+1}</span><span class="cbs" style="color:${scoreColor(x.v.s)}">${x.v.s}</span><span class="cbb"><b${set.wk&&wk?' style="color:#a9c1ff"':''}>${fmtDay(x.d,{weekday:'short',day:'numeric',month:'short'})}</b> ${moonOf(x.d).e} · ${fmtT(x.v.t)}${x.v.s>=90?' ⭐':''} ${x.v.fc?'<span class="mut">· forecast</span>':'<span class="mut">· outlook</span>'}<br><span class="mut">${p.name?ptLabel(p):''}</span></span></button>`;}).join('')}</div>`:'<p class="mut">No days match the filters yet.</p>');
  $('calList').querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{set.range=b.dataset.r;sv(KEY,set);render();});
  $('calList').querySelectorAll('.cbr').forEach(b=>b.onclick=()=>openDay(b.dataset.d));}
function renderLegend(){const P=st.cfg;const wx=P&&P.wxInfo&&P.wxInfo.ok?`weather forecast to ${fmtDay(MJ.ymd(P.wxInfo.to,TZ))}${P.wxInfo.cached?' (cached — offline)':''}`:'no weather forecast (offline?) — all days are outlook';
  $('calLegend').innerHTML=`<span>best score ${FTRamp.legend()}</span><span>★ 90+</span><span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#5cc8ff"></span> forecast weather (else outlook: tide, sun &amp; moon only)</span>${set.wk?'<span style="color:#a9c1ff">▢ weekend</span>':''}`;
  const sc=set.scope==='sys'?`whole system — ${st.pts.length} points (every ~1.5–2 km + landmarks + your spots)`:set.scope==='mine'?`your ${st.pts.length} spot${st.pts.length===1?'':'s'} (each scored with its spot type)`:`one spot: ${st.pts[0]?esc(st.pts[0].name):''}`;
  $('calNote').innerHTML=`Best bite score of each day for ${sc}${set.dd?', dawn/dusk only (sun between −12° and +10°)':''}. Same scoring as 🎣 Bite times (tide model${GEN?'':' incl. single-high tide stands'}, spot types, light, solunar, moon, flood cycle). Month view = quick 30-min scan; tap a day for the exact 15-min windows. ${wx}; beyond it scores use neutral weather and a seasonal water temperature. Weather comes from one public point (${esc(P?P.ref.name:'')}) — your spots never leave this phone.`;}
/* ---------- day detail ---------- */
function stageOf(T,t){for(const s of T.stands||[])if(t>=s.t0-15*6e4&&t<=s.t1)return'stand';const a=MJ.stageAt?MJ.stageAt(t,T.ext,T.runIn):{c:''};return a.c==='flood'?'ri':a.c||'';}
const stTag=c=>{const s=STG[c];return s?`<span class="cstg" style="background:${s[1]}">${s[0]}</span>`:'';};
function reasonsOf(p,dd){const r=[];if(p.L)r.push(p.L.label);if(p.T)r.push(p.T.label);if(p.DEP)r.push(p.DEP.label);if(p.S&&p.S.v>=0.3)r.push(p.S.label);
  if(dd.mpf>=0.75)r.push(MJ.phaseName(dd.illum.phase)+' (strong moon)');if(p.WX&&p.WX.notes)r.push(...p.WX.notes.slice(0,2));if(p.TF&&p.TF.est)r.push('Water temp: seasonal estimate');return r;}
function winsOf(R){const dd=R.dd;let W=dd.windows.slice();if(set.dd){W=W.filter(w=>w.peak.alt>=C.DDLO&&w.peak.alt<=C.DDHI);
    if(!W.length){let b=null;for(const p of dd.pts)if(p.alt>=C.DDLO&&p.alt<=C.DDHI&&(!b||p.score>b.score))b=p;if(b)W=[{start:b.t-30*6e4,end:b.t+45*6e4,peak:b,score:b.score}];}}
  return W.map(w=>({w,score:w.score,pt:R.pt,stage:stageOf(R.T,w.peak.t),reasons:reasonsOf(w.peak,dd)}));}
const refC={};function refine(pt,ds){const k=st.base+'|'+ds+'|'+pt.km+'|'+pt.line+'|'+pt.type+'|'+pt.lat;if(!refC[k]){const R=st.core.refine(pt,ds);R.pt=pt;refC[k]=R;}return refC[k];}
function overlap(a,b){return a.w.start<b.w.end&&b.w.start<a.w.end;}
function dayEvents(ds,rows){return rows.map(x=>({start:x.w.start,end:x.w.end,title:`🎣 Jacks ${x.score} · ${STG[x.stage]?STG[x.stage][2]+' · ':''}${FT.SYSSHORT} ${x.pt.custom?'★ my spot':x.pt.name} (km ${x.pt.km.toFixed(1)})`,desc:`Mac's Jacks bite score ${x.score}/100, ${fmtT(x.w.start)}–${fmtT(x.w.end)}. ${x.reasons.join('; ')}.`}));}
async function openDay(ds){const sh=$('calSheet');sh.hidden=false;document.body.style.overflow='hidden';const mo=moonOf(ds),fc=st.core?st.core.fcOf(ds):false;
  $('calSheetT').textContent=fmtDay(ds,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('calSheetB').innerHTML='<p class="mut"><span class="spin"></span> Scoring this day at 15-min steps…</p>';await new Promise(r=>setTimeout(r,30));
  if(!st.core){$('calSheetB').innerHTML='<p class="mut">Still preparing — try again in a moment.</p>';return;}
  const r=st.data[ds],o=set.dd?2:0,idx=st.pts.map((p,i)=>i);let cand;
  if(set.scope!=='sys')cand=idx;else if(r)cand=idx.filter(i=>r.p[i]&&r.p[i][o]>=0).sort((a,b)=>r.p[b][o]-r.p[a][o]).slice(0,8);else cand=idx.filter((i,k)=>k%Math.max(1,Math.round(idx.length/12))===0);
  const t0=performance.now();const all=[];for(const i of cand){try{all.push(...winsOf(refine(st.pts[i],ds)));}catch(e){console.error('cal refine',e);}}
  all.sort((a,b)=>b.score-a.score);const top=[];for(const x of all){if(top.length>=3)break;if(top.some(y=>overlap(x,y)&&y.pt.line===x.pt.line&&Math.abs(y.pt.km-x.pt.km)<4))continue;if(top.some(y=>y.pt===x.pt&&overlap(x,y)))continue;top.push(x);}
  /* the user's own spots, ranked (spot type shapes each score) */
  const mine=(S?S.customs():[]).map(lmPt).map(p=>{try{const W=winsOf(refine(p,ds)).sort((a,b)=>b.score-a.score);return{p,w:W[0]||null,more:W.slice(1,3)};}catch(e){return{p,w:null,more:[]};}}).sort((a,b)=>(b.w?b.w.score:-1)-(a.w?a.w.score:-1));
  const ms=performance.now()-t0;st.sheet={ds,top,mine,ms,targets:[]};
  const T=st.sheet.targets,btns=x=>{T.push(x.pt);const k=T.length-1;return `<div class="cwbtn"><button class="sm pri" data-act="bite" data-k="${k}">🎣 Bite times here</button><button class="sm" data-act="tides" data-k="${k}">🌊 Tides</button><button class="sm" data-act="map" data-k="${k}">🗺 Map</button></div>`;};
  const win=x=>`<div class="cwin" style="border-left-color:${scoreColor(x.score)}"><div class="cws" style="color:${scoreColor(x.score)}">${x.score}</div><div class="cwb"><b>${fmtT(x.w.start)} – ${fmtT(x.w.end)}</b> ${stTag(x.stage)} <span class="mut">${STG[x.stage]?STG[x.stage][2]:''}</span><br>${ptLabel(x.pt)}<ul>${x.reasons.map(s=>'<li>'+esc(s)+'</li>').join('')}</ul>${FT.lureHtml?FT.lureHtml({depth:x.pt.depth,km:x.pt.km,line:x.pt.line||null,lat:x.pt.lat,lng:x.pt.lng},x.w.peak.t):''}${FT.cross?FT.cross.reachNote(x.pt,x.w.start,x.w.end):''}${btns(x)}</div></div>`;
  const stands=[];if(!GEN)for(const x of top){const R=refine(x.pt,ds);const s0=MJ.dayStart(ds,TZ);for(const s of R.T.stands||[])if(s.t>=s0&&s.t<s0+DAY&&!stands.some(q=>q.n===x.pt.name))stands.push({n:x.pt.name,s});}
  $('calSheetB').innerHTML=`<p class="csub">${mo.e} ${esc(mo.n)}, ${Math.round(mo.f*100)}% lit · ${fc?'<span class="tagf">FORECAST</span> weather &amp; sea temp from the forecast':'<span class="tago">OUTLOOK</span> tide, sun &amp; moon (+ flood cycle) — weather neutral, seasonal water temp'}${set.dd?' · dawn/dusk only':''}</p>`+
    `<div class="row" style="margin:-2px 0 8px"><button class="sm pri" id="calPlan">🗓 Plan my day</button><span class="mut" style="font-size:.76rem">fish / move / rest schedule for ${esc(FT.SYSSHORT)}</span></div>`+
    `<h3 class="csec">🎯 Top windows — ${set.scope==='sys'?'whole '+esc(FT.SYSSHORT):set.scope==='mine'?'my spots':esc(st.pts[0]?st.pts[0].name:'')}</h3>`+(top.length?top.map(win).join(''):'<p class="mut">No standout windows.</p>')+
    (stands.length?`<p class="mut" style="font-size:.78rem">🌗 Single-high day: tide stand at ${stands.map(x=>esc(x.n)+' '+fmtT(x.s.t0)+'–'+fmtT(x.s.t1)).join(', ')} — the small high doesn’t reach there.</p>`:'')+
    `<h3 class="csec">📌 My spots this day</h3>`+(mine.length?mine.map((x,k)=>x.w?`<div class="cwin" style="border-left-color:${scoreColor(x.w.score)}"><div class="cws" style="color:${scoreColor(x.w.score)};font-size:1.25rem">${x.w.score}</div><div class="cwb"><span class="mut">${k+1}.</span> ${ptLabel(x.p)} ${x.p.type&&S?`<span class="cstg" style="background:${S.TYPES[x.p.type].col}">${S.TYPES[x.p.type].s}</span>`:''}<br><b>${fmtT(x.w.w.start)} – ${fmtT(x.w.w.end)}</b> ${stTag(x.w.stage)} <span class="mut">${esc(x.w.reasons[1]||'')}${x.more.length?' · also '+x.more.map(m=>fmtT(m.w.start)+' ('+m.score+')').join(', '):''}</span>${btns(x.w)}</div></div>`:`<div class="cwin"><div class="cwb">${ptLabel(x.p)} — no window</div></div>`).join(''):'<p class="mut">Add your own spots on the 🗺️ Map tab — they’re ranked here for each day.</p>')+
    `<div class="row" style="margin-top:8px"><button class="sm" id="calIcsDay">📆 Add this day’s top windows to my calendar (.ics)</button></div><p class="mut" style="font-size:.74rem">Exact 15-min scoring (same inputs as 🎣 Bite times for that spot and date) · ${Math.round(ms)} ms.</p>`;
  $('calSheetB').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act,T[+b.dataset.k],ds));
  $('calPlan').onclick=()=>{closeSheet();FT.planDay&&FT.planDay(ds);};
  $('calIcsDay').onclick=()=>{if(!top.length)return;dl(`macs-jacks-${SYS}-${ds}.ics`,ics(dayEvents(ds,top)));};
  document.body.dataset.calSheet=ds;}
function closeSheet(){$('calSheet').hidden=true;document.body.style.overflow='';delete document.body.dataset.calSheet;}
function locOf(p){return Object.assign({name:p.name+SFX,lat:p.lat,lng:p.lng,tz:TZ,baffleKm:p.km},p.id?{spotId:p.id}:{},GEN?{baffleLine:p.line||'M',sys:SYS}:p.line?{baffleLine:p.line}:{});}
function act(a,p,ds){if(!p)return;closeSheet();
  if(a==='bite'){if(FT.biteGo)FT.biteGo(locOf(p),ds);else{FT.setDate(ds,'cal');FT.biteSetLoc(locOf(p));}FT.showTab('bite');}
  else if(a==='tides'){FT.baffleSelect(p.km,p.lm?p.name:null,p.line);FT.setDate(ds,'cal');FT.showTab('baffle');}
  else if(a==='map'){FT.showTab('map');let n=0;const go=()=>{const M=FT.mapDebug&&FT.mapDebug.map;if(!M){if(n++<40)setTimeout(go,150);return;}M.setView([p.lat,p.lng],Math.max(M.getZoom(),15));if(p.custom&&p.id&&FT.mapDebug.openSpot)setTimeout(()=>FT.mapDebug.openSpot(p.id),300);};setTimeout(go,200);}}
/* ---------- .ics (local download only) ---------- */
const z=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const ie=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
function fold(l){const o=[];while(l.length>72){o.push(l.slice(0,72));l=' '+l.slice(72);}o.push(l);return o.join('\r\n');}
function ics(evs){const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mac\'s Jacks//Bite calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const e of evs){const u=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,'0')).join('');
    L.push('BEGIN:VEVENT','UID:'+u+'@macs-jacks','DTSTAMP:'+z(Date.now()),'DTSTART:'+z(e.start),'DTEND:'+z(e.end),fold('SUMMARY:'+ie(e.title)),fold('DESCRIPTION:'+ie(e.desc)),'END:VEVENT');}
  L.push('END:VCALENDAR');return L.join('\r\n')+'\r\n';}
function dl(name,txt){const b=new Blob([txt],{type:'text/calendar;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);FT.calLastIcs={name,txt};}
async function icsMonth(){const days=allDays().filter(d=>d.slice(0,7)===st.month).map(d=>({d,v:cellVal(d)})).filter(x=>x.v&&x.v.s>=90);
  if(!days.length){alert('No 90+ days computed in '+monthName(st.month)+' yet'+(set.dd?' (dawn/dusk only)':'')+'.');return;}
  const evs=[];for(const x of days){const p=st.pts[x.v.i];try{const W=winsOf(refine(p,x.d)).sort((a,b)=>b.score-a.score);if(W[0])evs.push(...dayEvents(x.d,[W[0]]));}catch(e){}}
  dl(`macs-jacks-${SYS}-${st.month}-90plus.ics`,ics(evs));}
/* ---------- controls ---------- */
function fillScope(){const cs=S?S.customs():[],lm=(S?S.builtins():B.LANDMARKS);
  $('calScope').innerHTML=`<option value="sys">Whole system (${esc(FT.SYSSHORT)})</option><option value="mine">My spots (${cs.length})</option>`+
    (cs.length?`<optgroup label="One of my spots">${cs.map(c=>`<option value="lm:${esc(c.id)}">★ ${esc(c.name)} (km ${(+c.km).toFixed(1)})</option>`).join('')}</optgroup>`:'')+
    `<optgroup label="One landmark">${lm.map(l=>`<option value="lm:${esc(l.id)}">${esc(l.name)} (km ${(+l.km).toFixed(1)})</option>`).join('')}</optgroup>`;
  if(![...$('calScope').options].some(o=>o.value===set.scope))set.scope='sys';$('calScope').value=set.scope;}
function init(){st.inited=true;$('calSys').textContent=FT.SYSNAME;st.month=months()[0];fillScope();
  $('calDD').checked=!!set.dd;$('calMin').value=String(set.min||0);$('calWk').checked=set.wk!==false;
  $('calScope').onchange=()=>{set.scope=$('calScope').value;sv(KEY,set);start();};
  $('calDD').onchange=()=>{set.dd=$('calDD').checked;sv(KEY,set);render();};
  $('calMin').onchange=()=>{set.min=+$('calMin').value;sv(KEY,set);render();};
  $('calWk').onchange=()=>{set.wk=$('calWk').checked;sv(KEY,set);render();};
  document.querySelectorAll('#calViewSeg button').forEach(b=>b.onclick=()=>{set.view=b.dataset.v;sv(KEY,set);render();});
  const nav=k=>{const M=months(),i=M.indexOf(st.month)+k;if(i<0||i>=M.length)return;st.month=M[i];render();
    if(st.worker)st.worker.postMessage({type:'prio',gen:st.gen,key:st.month});else if(st.runner)st.runner.prio(st.month);};
  $('calPrev').onclick=()=>nav(-1);$('calNext').onclick=()=>nav(1);
  let tx=null,ty=null;const g=$('calGridWrap');g.addEventListener('touchstart',e=>{const t=e.touches[0];tx=t.clientX;ty=t.clientY;},{passive:true});
  g.addEventListener('touchend',e=>{if(tx==null)return;const t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;tx=null;if(Math.abs(dx)>50&&Math.abs(dx)>1.5*Math.abs(dy))nav(dx<0?1:-1);},{passive:true});
  $('calGrid').onclick=e=>{const b=e.target.closest('button.cc[data-d]');if(b)openDay(b.dataset.d);};
  $('calSheetX').onclick=closeSheet;$('calSheet').querySelector('.calsheet-bg').onclick=closeSheet;
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('calSheet').hidden)closeSheet();});
  $('calIcsMonth').onclick=icsMonth;
  FT.calNav=nav;start();}
let dirty=false;
if(S)S.onChange.push(()=>{if(!st.inited)return;fillScope();dirty=true;if(document.body.dataset.tab==='cal'){dirty=false;start();}});
FT.onTab.push(t=>{if(t!=='cal')return;if(!st.inited)init();else if(dirty){dirty=false;start();}else{const o=Object.assign({},FT.baffleOpts?FT.baffleOpts():{});delete o.line;if(st.cfg&&JSON.stringify(o)!==JSON.stringify(st.cfg.opts))start();else render();}});
FT.calApi={buildCfg,lmPt,scanPts,lineList,refPoint,isMainLine,lineShort,ptLabel,esc,fmtT,fmtDay,scoreColor,heat,ics,dl,STG,stTag,moonOf,
  workerURL(){if(!WURL)WURL=URL.createObjectURL(new Blob(['self.window=self;self.FT={};self.__ftCalWorker=1;\n'+workerSrc()],{type:'text/javascript'}));return WURL;},get cfg(){return st.cfg;}};
FT.cal={get st(){return st},get set(){return set},openDay,start,closeSheet,cellVal,refine:(pt,ds)=>st.core.refine(pt,ds),ptsFor,bestDays,ics,winsOf};
})();
