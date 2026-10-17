/* ===================== Catch log tab ===================== */
(function(){
'use strict';
const $=id=>document.getElementById(id);const FT=window.FT;
const SCH=/*SCHEMA*/null;
const RELAY='https://ntfy.sh/'+SCH.topic;
const TZ='Australia/Brisbane',Q=15*60e3,AEST=10*3600e3;
const K={log:'mbj_log',act:'mbj_active',share:'mbj_share',q:'mbj_shareq',test:'mbj_test',view:'mbj_view'};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
const rid=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');};
async function sha(s){if(crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
  let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h.toString(16).padStart(8,'0').repeat(8);}
const SPN=Object.fromEntries(SCH.species),FATEN=Object.fromEntries(SCH.fates),BAITN=Object.fromEntries(SCH.bait);
const PH=['New','Wax cres','1st qtr','Wax gib','Full','Wan gib','Last qtr','Wan cres'];
const phIdx=p=>Math.floor(((p+1/16)%1)*8);
const LIGHTN={night:'Night',dawn:'Dawn',dusk:'Dusk',lowsun:'Low sun',day:'Day'};
const TIDEN={runin:'Run-in start (0–2 h)',rising:'Rising',falling:'Falling',slack:'Slack',pool:'Pool level',none:'No tide'};
const GEN=!!(window.BT&&BT.generic),SYS=FT.SYS||'baffle';const sysOf=sp=>(sp&&sp.sys)||'baffle';
const TSRCN={baffle:GEN?'river tide model':'Baffle model',marine:'Open-Meteo marine',none:'none'};
/* ---- time helpers (always AEST) ---- */
const pad=n=>String(n).padStart(2,'0');
function toLocalInput(ms){const d=new Date(ms+AEST);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;}
function fromLocalInput(v){const m=/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)/.exec(v||'');return m?Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5])-AEST:null;}
const isoA=ms=>toLocalInput(ms).replace('T',' ');
const fT=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace(' am','am').replace(' pm','pm');
const fD=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short',day:'numeric',month:'short',year:'2-digit'}).format(new Date(ms));
const dur=m=>m<60?Math.round(m)+' min':(m/60).toFixed(1)+' h';
function scoreColor(s){const l=(x,a,b,c,d)=>c+(d-c)*(x-a)/(b-a);const h=s<50?l(s,0,50,210,45):l(s,50,100,45,135);return `hsl(${h},75%,${s<20?40:52}%)`;}
/* ---- spots & privacy bands ---- */
function bandOf(km,line,sp){if(km==null)return null;
  if(sp&&sysOf(sp)!=='baffle'){const bk=Math.max(0,Math.floor(km/2)*2);const ln=line||'M';return{bk,ln,sy:sysOf(sp),label:`km ${bk}–${bk+2}, ${sp.lineName||(sysOf(sp)===SYS?BT.lineName(ln):sysOf(sp))}`};}if(BT.isSide&&BT.isSide(line)&&SCH.sides&&SCH.sides[line]){const sd=BT.sideOf(line);const bk=Math.max(0,Math.floor((km-sd.jk)/2)*2);return{bk,ln:line,label:`${SCH.sides[line][0]} km ${bk}–${bk+2}`};}
  const bk=Math.max(0,Math.min(38,Math.floor(km/2)*2));const E=line==='E'&&SCH.bandsE[bk];
  return{bk,ln:E?'E':'B',label:`km ${bk}–${bk+2}, ${E?SCH.bandsE[bk]:SCH.bands[bk]}`};}
function distKm(a,b,c,d){const r=Math.PI/180,x=(d-b)*r*Math.cos((a+c)/2*r),y=(c-a)*r;return 6371*Math.hypot(x,y);}
function regionOf(lat,lng){let best=null;for(const g of SCH.regions){if(g[2]==null)continue;const d=distKm(lat,lng,g[2],g[3]);if(d<=30&&(!best||d<best.d))best={code:g[0],name:g[1],d};}
  return best||{code:'other',name:'Elsewhere'};}
const regionName=c=>(SCH.regions.find(g=>g[0]===c)||['other','Elsewhere'])[1];
function spotFromLatLng(lat,lng,acc,kind,name){let s=null;try{s=BT.snap(lat,lng);}catch(e){}
  const sp={kind,lat:+lat.toFixed(6),lng:+lng.toFixed(6),acc:acc!=null?Math.round(acc):null,name:name||'',km:null,line:null,offKm:s?+s.offKm.toFixed(2):null};
  if(GEN){sp.sys=SYS;if(s&&s.offKm<=0.6){sp.km=+s.km.toFixed(2);sp.line=s.lineId;sp.lineName=s.line;}return sp;}
  if(s&&s.offKm<=0.6&&s.km<=(BT.lineMaxKm?BT.lineMaxKm(s.lineId||'B'):BT.MAXKM)+1e-6){sp.km=+s.km.toFixed(2);sp.line=s.lineId||(s.line==='Euleilah Creek'?'E':'B');}
  return sp;}
function shareBand(sp){if(!sp)return null;if(sp.km!=null)return bandOf(sp.km,sp.line,sp);
  if(sysOf(sp)!=='baffle'){const S=FT.sysById&&FT.sysById(sysOf(sp));return{bk:-1,rg:'other',sy:sysOf(sp),label:'Off-creek: near '+(S?S.name:sysOf(sp))};}const r=regionOf(sp.lat,sp.lng);return{bk:-1,rg:r.code,label:'Off-creek: '+r.name};}
function nearLandmark(km,line){let b=null;for(const l of BT.LANDMARKS){if(GEN&&line&&l.line&&!BT.sameReach(km,line,l.km,l.line))continue;if(!GEN&&BT.isSide&&(BT.isSide(line)||BT.isSide(l.line))&&(l.line||'B')!==(line||'B'))continue;const d=Math.abs(l.km-km);if(!b||d<b.d)b={n:l.name,d};}return b&&b.d<1.5?b.n:null;}
function spotDesc(sp){if(!sp)return '—';const nm=sp.name?esc(sp.name)+' · ':'';
  const here=sysOf(sp)===SYS;
  if(sp.km!=null){let lm=here?nearLandmark(sp.km,sp.line):null;if(lm&&lm===sp.name)lm=null;
    if(sysOf(sp)==='baffle'&&FT.spots&&FT.spots.alongLabel(sp.km,sp.line)){let lm=here?nearLandmark(sp.km,sp.line):null;if(lm&&lm===sp.name)lm=null;return `${nm}${esc(FT.spots.alongLabel(sp.km,sp.line))} up${lm?' (near '+esc(lm)+')':''}`;}
    const ln=sysOf(sp)==='baffle'?(sp.line==='E'?'Euleilah Ck':'Baffle Ck'):esc(sp.lineName||sp.line);return `${nm}km ${sp.km.toFixed(1)} ${ln}${lm?' (near '+esc(lm)+')':''}`;}
  if(sysOf(sp)!=='baffle')return `${nm}off-channel near ${esc((FT.sysById&&FT.sysById(sysOf(sp))||{name:sysOf(sp)}).name)}${sp.kind==='gps'||sp.kind==='bite'?' ('+sp.lat.toFixed(3)+', '+sp.lng.toFixed(3)+')':''}`;
  return `${nm}off-creek — ${esc(regionOf(sp.lat,sp.lng).name)}${sp.kind==='gps'||sp.kind==='bite'?' ('+sp.lat.toFixed(3)+', '+sp.lng.toFixed(3)+')':''}`;}
/* ---- storage ---- */
let LOG=LS.get(K.log,[]);if(!Array.isArray(LOG))LOG=[];
let SH=LS.get(K.share,null);if(!SH||!SH.k){SH={on:false,k:rid(16)};LS.set(K.share,SH);}
const isTest=()=>LS.get(K.test,0)?1:0;
const save=()=>LS.set(K.log,LOG);
const activeS=()=>LOG.find(s=>s.end==null);
const byId=id=>LOG.find(s=>s.id===id);
/* ---- prediction context ---- */
function computeCtx(s){if(!FT.biteCtx||!s.spot)return null;if(sysOf(s.spot)!==SYS)return s.ctx||null; /* other river system: keep the context computed there */try{const t1=s.end!=null?s.end:Date.now();return FT.biteCtx(s.spot,s.start,Math.max(t1,s.start+Q));}catch(e){console.error('ctx',e);return null;}}
function lightOf(alt,t){if(alt==null)return null;if(alt<-12)return 'night';if(alt<6)return new Date(t+AEST).getUTCHours()<12?'dawn':'dusk';if(alt<20)return 'lowsun';return 'day';}
function tideOf(sl,src){if(src==='none'||!sl.tl)return 'none';if(sl.ri!=null&&sl.ri>=0&&sl.ri<120)return 'runin';if(/pool/i.test(sl.tl))return 'pool';if(sl.rising)return 'rising';if(/slack/i.test(sl.tl))return 'slack';return 'falling';}
/* session -> analysis rows (one per 15-min slot) — same shape as community rows */
/* spot type of a session (from the spot record, else the context) */
function stOf(s){const t=s.spot&&s.spot.stype!=null?s.spot.stype:(s.ctx&&s.ctx.stype)||'';return SCH.stype&&SCH.stype.includes(t)?t:'';}
function rowsOf(s,anon){const c=s.ctx;if(!c||!c.slots||!c.slots.length)return [];const b=shareBand(s.spot);const mp=phIdx(c.moon.phase);
  const rows=c.slots.map(sl=>({anon,sid:s.id,t:sl.t,bk:b.bk,ln:b.ln||'',rg:b.rg||'',sy:b.sy||'baffle',band:b.label,score:sl.score,tide:tideOf(sl,c.tideSrc),ri:sl.ri,light:lightOf(sl.alt,sl.t),sol:sl.sol,mp,ts:c.tideSrc,wind:sl.wind,dp3:sl.dp3,bites:0,fish:0,mj:0,kept:0,ml:null,sp:[],bait:s.bait&&s.bait.cat||'',stg:sl.stg||'',st:stOf(s),co:!!s.co}));
  for(const x of s.catches||[]){let i=Math.floor((x.t-rows[0].t)/Q);i=Math.max(0,Math.min(rows.length-1,i));const r=rows[i];const n=Math.max(1,Math.min(20,x.n|0||1));
    r.bites+=n;if(x.fate!=='bite'){r.fish+=n;if(x.sp==='MJ')r.mj+=n;if(x.fate==='kept')r.kept+=n;if(x.len)r.ml=Math.max(r.ml||0,x.len);}if(!r.sp.includes(x.sp))r.sp.push(x.sp);}
  return rows;}
/* ---- UI: selects ---- */
function fillSelects(){
  $('cSp').innerHTML=SCH.species.map(([c,n])=>`<option value="${c}">${esc(n)}</option>`).join('');
  $('cFate').innerHTML=SCH.fates.map(([c,n])=>`<option value="${c}">${esc(n)}</option>`).join('');
  if(window.FTLure)$('cColourL').innerHTML=Object.values(FTLure.COLOURS).map(c=>`<option value="${esc(c[0])}">`).join('');
  $('cBaitCat').innerHTML=SCH.bait.map(([c,n])=>`<option value="${c}">${esc(n)}</option>`).join('');
  fillSpotSel();}
function fillSpotSel(){const L=BT.LANDMARKS,mine=L.map((l,i)=>[l,i]).filter(x=>x[0].custom),bi=L.map((l,i)=>[l,i]).filter(x=>!x[0].custom);
  const opt=([l,i])=>`<option value="L${i}">${l.custom?'★ ':''}${esc(l.name)} (${l.km.toFixed(1)} km)</option>`;
  $('cSpotSel').innerHTML='<option value="">— pick a spot —</option>'+(mine.length?'<optgroup label="My spots">'+mine.map(opt).join('')+'</optgroup>':'')+'<optgroup label="'+esc(GEN?FT.SYSNAME:'Baffle Creek')+' landmarks">'+bi.map(opt).join('')+'</optgroup>'+
    (GEN?'':'<optgroup label="Off Baffle Creek (broad area)">'+SCH.regions.filter(g=>g[2]!=null).map(g=>`<option value="R${g[0]}">${esc(g[1])}</option>`).join('')+'</optgroup>')+'<option value="cur" hidden>current</option>';}
function landmarkSpot(l){const ll=FT.spots?FT.spots.latLng(l):BT.pointAtKm(l.km);const sp=spotFromLatLng(ll[0],ll[1],null,'landmark',l.name);sp.km=l.km;sp.line=l.line||(GEN?'M':(/Hills Rd/.test(l.base||l.name)&&l.km>16.4?'E':'B'));if(GEN)sp.lineName=BT.lineName(sp.line);sp.spotId=l.id;if(l.custom||l.type!==undefined)sp.stype=l.type||'';return sp;}
/* ---- form ---- */
let F=null; // session being edited
function openForm(s,mode){F=JSON.parse(JSON.stringify(s));F._mode=mode;$('cFormCard').hidden=false;
  if(mode==='edit'&&F.co)mode=F._mode='catch';const CO=mode==='catch';$('cSessRow').hidden=CO;
  $('cFormTitle').textContent=CO?'Log a catch (catch-only)':mode==='active'?'Session in progress':mode==='edit'?'Edit session':'Log a past session';
  $('cEndLab').style.display=mode==='active'?'none':'';
  $('cS0').value=toLocalInput(F.start);$('cS1').value=F.end!=null?toLocalInput(F.end):toLocalInput(Date.now());
  setCaught(F.noBites?'n':(F.catches||[]).length||mode==='active'?'y':mode==='edit'?'n':'');$('cBaitCat').value=F.bait&&F.bait.cat||'';$('cBait').value=F.bait&&F.bait.txt||'';$('cNote').value=F.note||'';
  $('cSpotName').value=F.spot&&F.spot.name||'';nameTyped=false;$('cCt').value=toLocalInput(Math.min(Date.now(),F.end||Date.now()));$('cFormMsg').textContent='';
  $('cSave').textContent=CO?'💾 Save catch':mode==='active'?'💾 Save (keep session running)':'💾 Save session';
  if(CO){$('cFormMsg').textContent='';}
  spotUI();catchUI();coUI(mode==='catch');$('cFormCard').scrollIntoView({behavior:'smooth',block:'start'});}
function setCaught(v){$('cYesBites').checked=v==='y';$('cNoBites').checked=v==='n';const co=F&&F._mode==='catch';$('cCatchSec').hidden=!co&&v!=='y';}
function coUI(CO){const fc=$('cFormCard');fc.classList.toggle('co',CO);['cSessRow','cCaughtRow','cSessExtra','cCatchH','cCatchList','cAddCatch'].forEach(id=>$(id).hidden=CO);
  $('cCtLab').textContent=CO?'Date & time caught':'Time';$('cCnote').placeholder=CO?'Notes (optional, stays on phone)':'Catch note (optional, stays on phone)';
  if(CO){$('cCatchSec').hidden=false;const c=(F.catches||[])[0];$('cCt').value=toLocalInput(c?c.t:Math.min(Date.now(),Math.floor(Date.now()/60e3)*60e3));
    if(c){$('cSp').value=c.sp;$('cN').value=c.n||1;$('cLen').value=c.len||'';$('cFate').value=c.fate;$('cCnote').value=c.note||'';$('cColour').value=c.colour||'';}else{$('cLen').value='';$('cCnote').value='';$('cN').value=1;$('cColour').value='';}}}
const fishTyped=()=>$('cLen').value!==''||$('cCnote').value.trim()!==''||$('cColour').value.trim()!=='';
function closeForm(){F=null;$('cFormCard').hidden=true;}
function spotUI(){const sp=F&&F.spot;$('cSpotSel').value=sp?(sp.kind==='landmark'?((i=>i>=0?'L'+i:'cur')(BT.LANDMARKS.findIndex(l=>sp.spotId?l.id===sp.spotId:Math.abs(l.km-sp.km)<0.01))):sp.kind==='region'?'R'+sp.rg:'cur'):'';
  const b=shareBand(sp);
  $('cSpotInfo').innerHTML=sp?`📍 <b>${spotDesc(sp)}</b>${sp.acc!=null?' ±'+sp.acc+' m':''}<br>🔒 Shared as: <b>${esc(b.label)}</b>${sp.km==null&&sp.offKm!=null?` <span class="mut">(${sp.offKm.toFixed(1)} km from the ${GEN?esc(FT.SYSNAME):'Baffle'} channel — not snapped)</span>`:''}`:'Pick a spot: 📡 GPS (snaps to the creek), a landmark, the Bite-times spot, or a broad off-creek area.';}
function catchUI(){const L=(F.catches||[]).slice().sort((a,b)=>a.t-b.t);
  $('cCatchList').innerHTML=L.length?L.map(x=>`<div class="citem"><div class="ci">🐟 <b>${x.n>1?x.n+'× ':''}${esc(SPN[x.sp]||x.sp)}</b>${x.len?' '+x.len+' cm':''}${x.colour?' · 🎨 '+esc(x.colour):''} · ${esc(FATEN[x.fate]||x.fate)} <span class="mut">${fT(x.t)}${x.note?' · '+esc(x.note):''}</span></div><button class="sm" data-del="${x.id}">✕</button></div>`).join('')
    :`<div class="cempty">${$('cNoBites').checked?'No bites — that’s useful data too.':'No bites/catches added yet.'}</div>`;
  $('cCatchList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{F.catches=F.catches.filter(x=>x.id!==b.dataset.del);catchUI();});}
function readForm(){if(F._mode==='catch'){const old=(F.catches||[])[0];F.catches=[];addCatch();if(old&&F.catches[0])F.catches[0].id=old.id;const c=(F.catches||[]).slice().sort((a,b)=>a.t-b.t)[0];
    if(c){F.start=Math.round(c.t/Q)*Q-Q;F.end=F.start+2*Q;}F.co=1;F.noBites=false;F.bait={cat:$('cBaitCat').value,txt:$('cBait').value.trim().slice(0,120)};F.note=$('cNote').value.trim().slice(0,500);if(F.spot)F.spot.name=$('cSpotName').value.trim().slice(0,80);return;}
  F.start=fromLocalInput($('cS0').value)||F.start;if(F._mode!=='active')F.end=fromLocalInput($('cS1').value);
  F.noBites=$('cNoBites').checked;if(F.noBites)F.catches=[];else if($('cYesBites').checked&&fishTyped())addCatch();
  F.bait={cat:$('cBaitCat').value,txt:$('cBait').value.trim().slice(0,120)};F.note=$('cNote').value.trim().slice(0,500);
  if(F.spot)F.spot.name=$('cSpotName').value.trim().slice(0,80);}
const MIN_T=Date.UTC(1990,0,1)-AEST,HIST_MS=400*864e5;const isHist=s=>s&&s.start<Date.now()-HIST_MS;
function validate(s){const now=Date.now();
  if(!s.spot)return 'Pick a spot first.';
  if(!s.start||isNaN(s.start))return 'Start time missing.';
  if(s.start>now+5*60e3)return 'Start is in the future.';
  if(s.start<MIN_T)return 'Start is before 1990 — the tide/moon model isn’t checked that far back.';
  if(s.end!=null){if(isNaN(s.end))return 'End time missing.';if(s.end<=s.start)return 'End must be after start.';if(s.end-s.start>16*3600e3)return 'Sessions are limited to 16 h — split longer trips.';if(s.end>now+5*60e3)return 'End is in the future.';}
  for(const x of s.catches||[]){if(x.t<s.start-Q||(s.end!=null&&x.t>s.end+Q))return `A catch at ${fT(x.t)} is outside the session times.`;}
  if(s.co&&!(s.catches||[]).length)return 'A catch-only entry needs a catch.';
  if(s.noBites&&(s.catches||[]).some(x=>x.n>0))return 'Untick “No bites” or remove the catches.';
  return null;}
function addCatch(){if(!F)return;const t=fromLocalInput($('cCt').value)||Date.now();let n=Math.round(+$('cN').value||1);n=Math.max(1,Math.min(20,n));
  let len=+$('cLen').value||null;if(len!=null){if(len<1||len>150){$('cFormMsg').textContent='Length must be 1–150 cm.';return;}len=Math.round(len*2)/2;}
  if(t>Date.now()+5*60e3){$('cFormMsg').textContent='Catch time is in the future.';return;}
  F.catches=F.catches||[];F.catches.push({id:rid(6),t,sp:$('cSp').value,n,len,fate:$('cFate').value,note:$('cCnote').value.trim().slice(0,200),...($('cColour').value.trim()?{colour:$('cColour').value.trim().slice(0,40)}:{})});$('cColour').value='';
  F.noBites=false;if(F._mode!=='catch')setCaught('y');$('cLen').value='';$('cCnote').value='';$('cN').value=1;$('cFormMsg').textContent='';catchUI();}
async function commit(s,{silent}={}){
  const err=validate(s);if(err){if(!silent)$('cFormMsg').textContent='⚠ '+err;return false;}
  if(s.end!=null&&s.start>s.end)return false;
  s.catches=(s.catches||[]).filter(x=>x.t>=s.start-Q);
  s.ctx=s.end!=null?computeCtx(s):null;s.saved=Date.now();
  const old=byId(s.id);const wasShared=old&&old.share&&old.share.sid;
  if(old)LOG[LOG.indexOf(old)]=s;else LOG.push(s);
  if(s.end!=null&&SH.on){if(wasShared){queueDel(old);s.tok=rid(12);s.share={st:'local'};}await shareSession(s);}
  save();return true;}
/* ---- live session ---- */
function newSession(start,end){return{id:rid(8),tok:rid(12),v:1,start,end,spot:curSpot?JSON.parse(JSON.stringify(curSpot)):null,bait:{cat:'',txt:''},note:'',noBites:false,catches:[],ctx:null,share:{st:'local'}};}
let curSpot=LS.get('mbj_lastspot',null);
let nameTyped=false;
function setSpot(sp){if(!sp)return;curSpot=sp;LS.set('mbj_lastspot',sp);if(F){const nm=nameTyped?$('cSpotName').value.trim():'';F.spot=JSON.parse(JSON.stringify(sp));F.spot.name=nm||sp.name||'';$('cSpotName').value=F.spot.name;spotUI();}renderActive();}
function gps(then,orElse){const m=F?$('cFormMsg'):null;
  if(!navigator.geolocation){if(m)m.textContent='No GPS on this device.';orElse&&orElse();return;}
  if(m)m.innerHTML='<span class="spin"></span> Getting GPS…';
  navigator.geolocation.getCurrentPosition(p=>{if(m)m.textContent='';setSpot(spotFromLatLng(p.coords.latitude,p.coords.longitude,p.coords.accuracy,'gps'));then&&then();},
    e=>{if(m)m.textContent='GPS failed: '+e.message;if(orElse)orElse();else if(!m)alert('GPS failed: '+e.message);},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});}
function biteSpot(){const L=FT.biteLoc&&FT.biteLoc();if(!L)return;const tag=sp=>{if(L.spotId){sp.spotId=L.spotId;sp.stype=L.stype||'';}return sp;};
  if(L.km!=null&&GEN){const p=BT.pointOnLine(L.km,L.line||'M');const sp=spotFromLatLng(p[0],p[1],null,'bite',L.name.replace(' — '+FT.SYSSHORT,''));sp.km=+L.km.toFixed(2);sp.line=L.line||'M';sp.lineName=BT.lineName(sp.line);setSpot(tag(sp));}
  else if(L.km!=null){const p=BT.pointAtKm(L.km);const sp=spotFromLatLng(p[0],p[1],null,'bite',L.name.replace(/ — Baffle Ck$/,''));if(sp.km==null){sp.km=L.km;sp.line='B';}setSpot(tag(sp));}
  else setSpot(tag(spotFromLatLng(L.lat,L.lng,null,'bite',L.name)));}
function renderActive(){const s=activeS();
  $('cStartRow').style.display=s?'none':'';
  if(!s){$('cActive').innerHTML='';return;}
  const m=(Date.now()-s.start)/60e3,n=(s.catches||[]).reduce((a,x)=>a+x.n,0);
  let sc='';try{const c=FT.biteCtx&&s.spot?FT.biteCtx(s.spot,Date.now(),Date.now()+Q):null;if(c&&c.slots[0])sc=`Predicted now <b style="color:${scoreColor(c.slots[0].score)}">${c.slots[0].score}</b> · ${esc(c.slots[0].tl||'no tide')}`+(c.slots[0].ri!=null?` · ${c.slots[0].ri>=0?'+':''}${dur(Math.abs(c.slots[0].ri)).replace(' ','\u00a0')} ${c.slots[0].ri>=0?'after':'before'} run-in start`:'');}catch(e){}
  $('cActive').innerHTML=`<div class="cact"><div class="big">🟢 Fishing since ${fT(s.start)} <span class="mut">(${dur(m)})</span></div>
   <div class="mut">${spotDesc(s.spot)} · ${n} bite${n===1?'':'s'}/catch${n===1?'':'es'} logged</div><div class="mut">${sc}</div>
   <div class="row" style="margin-top:8px"><button class="pri" id="cBite">🐟 Bite / catch now</button><button id="cNone">➕ No-bite note</button><button id="cEdit">✏️ Details</button><button id="cEnd">⏹ End session</button></div></div>`;
  $('cBite').onclick=()=>{openForm(s,'active');$('cCt').value=toLocalInput(Date.now());$('cSp').focus();};
  $('cEdit').onclick=()=>openForm(s,'active');
  $('cNone').onclick=()=>{openForm(s,'active');$('cNote').focus();};
  $('cEnd').onclick=async()=>{const x=byId(s.id);x.end=Math.max(Date.now(),x.start+60e3);if(x.end-x.start>16*3600e3)x.end=x.start+16*3600e3;
    if(!(x.catches||[]).length)x.noBites=confirm('End session with NO bites?\n\nOK = record as a no-bite session (counts toward catch rates)\nCancel = keep it but unmarked')||x.noBites;
    const ok=await commit(x,{silent:true});if(!ok){openForm(x,'edit');$('cFormMsg').textContent='⚠ '+validate(x);return;}closeForm();renderAll();};}
/* ---- list ---- */
function shareTag(s){const st=s.share&&s.share.st;if(!SH.on&&(!st||st==='local'))return '';
  return st==='published'?'<span class="ctag ok">shared ✓</span>':st==='sent'?'<span class="ctag sh">sent</span>':st==='queued'?'<span class="ctag q">queued</span>':'<span class="ctag">not shared</span>';}
function renderList(){const L=LOG.filter(s=>s.end!=null).sort((a,b)=>b.start-a.start);
  $('cCount').textContent=L.length?`· ${L.length} session${L.length>1?'s':''}`:'';
  if(!L.length){$('cList').innerHTML='<div class="cempty">No sessions logged yet.</div>';return;}
  $('cList').innerHTML=L.map(s=>{const sl=s.ctx&&s.ctx.slots||[];const avg=sl.length?Math.round(sl.reduce((a,b)=>a+b.score,0)/sl.length):null,mx=sl.length?Math.max(...sl.map(x=>x.score)):null;
    const n=(s.catches||[]).reduce((a,x)=>a+x.n,0),fish=(s.catches||[]).filter(x=>x.fate!=='bite').reduce((a,x)=>a+x.n,0);
    const sp=[...new Set((s.catches||[]).map(x=>SPN[x.sp]||x.sp))].join(', ');
    return `<div class="citem"><div class="sc" style="background:${avg!=null?scoreColor(avg):'#555'}" title="mean predicted score">${avg!=null?avg:'?'}</div><div class="ci">
      <b>${fD(s.start)} ${fT(s.start)}–${fT(s.end)}</b> <span class="mut">(${dur((s.end-s.start)/60e3)})</span>${shareTag(s)}${isTest()&&s.test?'<span class="ctag q">TEST</span>':''}<br>
      <span class="mut">${spotDesc(s.spot)}</span><br>
      ${n?`🐟 ${n} bite${n>1?'s':''}${fish!==n?` (${fish} landed)`:''} — ${esc(sp)}`:'<span class="mut">No bites</span>'} · <span class="mut">peak ${mx!=null?mx:'—'}, ${s.ctx?TSRCN[s.ctx.tideSrc]+(s.ctx.wx?' + weather':(isHist(s)?' · weather unknown':'')):'no context'}${isHist(s)?' <span class="ctag">historical</span>':''}${s.rough?' <span class="ctag">approx. time</span>':''}${s.co?' <span class="ctag">catch-only</span>':''}${s.bait&&s.bait.cat?' · '+esc(BAITN[s.bait.cat]):''}</span>
      </div><div class="row" style="flex-direction:column;gap:4px"><button class="sm" data-ed="${s.id}">✏️</button><button class="sm" data-rm="${s.id}">🗑</button></div></div>`;}).join('');
  $('cList').querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>openForm(byId(b.dataset.ed),'edit'));
  $('cList').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{const s=byId(b.dataset.rm);if(!confirm('Delete this session'+(s.share&&s.share.sid?' (and remove it from the shared table)':'')+'?'))return;
    if(s.share&&s.share.sid)queueDel(s);LOG=LOG.filter(x=>x!==s);save();renderAll();flush();});}
/* ---- sharing ---- */
async function anonId(){const h=await sha('mbj-anon:'+SH.k);return (isTest()?'TEST-':'')+h.slice(0,isTest()?5:10);}
const sidOf=async tok=>(await sha('mbj-sid:'+tok)).slice(0,12);
async function message(s){const rows=rowsOf(s,'');if(!rows.length)return null;const b=shareBand(s.spot);const T=SCH.tide,LI=SCH.light,SO=SCH.sol;
  const sid=await sidOf(s.tok);
  const m={v:1,app:'mbj',anon:await anonId(),sid,bk:b.bk,ln:b.ln||'B',rg:b.rg||'',...(b.sy?{sy:b.sy}:{}),ts:s.ctx.tideSrc,mp:rows[0].mp,bt:s.bait&&s.bait.cat||'',...(rows[0].st?{st:rows[0].st}:{}),s0:Math.round(rows[0].t/1000),...(isHist(s)?{hi:1}:{}),...(s.co?{co:1}:{}),
    sl:rows.map(r=>[r.score,T.indexOf(r.tide),r.ri,LI.indexOf(r.light),SO.indexOf(r.sol),r.wind,r.dp3,r.bites,r.fish,r.mj,r.kept,r.ml,r.sp.join(';'),r.stg?SCH.stage.indexOf(r.stg):null])};
  if(isTest())m.test=1;return{m,sid};}
async function shareSession(s){if(!s.ctx)return;const r=await message(s);if(!r)return;s.share={st:'queued',sid:r.sid,at:Date.now(),tries:(s.share&&s.share.tries||0)};if(isTest())s.test=1;
  const q=LS.get(K.q,[]);q.push({kind:'add',id:s.id,body:JSON.stringify(r.m)});LS.set(K.q,q);}
function queueDel(s){if(!s.share||!s.share.sid)return;const q=LS.get(K.q,[]).filter(x=>x.id!==s.id||x.kind!=='add');q.push({kind:'del',id:s.id,body:JSON.stringify({v:1,app:'mbj',op:'del',tok:s.tok})});LS.set(K.q,q);}
let flushing=false;
async function flush(){if(flushing)return;flushing=true;try{let q=LS.get(K.q,[]);const left=[];
  let n=0;for(const it of q){if(n>=40){left.push(it);continue;}if(n++)await new Promise(r=>setTimeout(r,1500));let ok=false;try{const r=await fetch(RELAY,{method:'POST',body:it.body,headers:{'Content-Type':'text/plain'}});ok=r.ok;}catch(e){}
    if(ok){if(it.kind==='add'){const s=byId(it.id);if(s&&s.share){s.share.st='sent';s.share.at=Date.now();s.share.tries=(s.share.tries||0)+1;}}}else left.push(it);}
  LS.set(K.q,left);save();shareInfo();renderList();if(left.length&&n>=40&&left.length<q.length)setTimeout(flush,60e3);}finally{flushing=false;}}
function shareInfo(){const q=LS.get(K.q,[]);const n=LOG.filter(s=>s.share&&s.share.sid).length,p=LOG.filter(s=>s.share&&s.share.st==='published').length;
  const unshared=LOG.filter(s=>s.end!=null&&s.ctx&&!(s.share&&s.share.sid)).length;
  $('cShareInfo').innerHTML=SH.on?`Sharing <b>on</b>${isTest()?' <span class="ctag q">TEST mode</span>':''} · ${n} session${n===1?'':'s'} shared${p?` (${p} already in the community table)`:''}${q.length?` · ${q.length} waiting to send (offline?) <button class="sm" id="cFlush">retry</button>`:''}${unshared?` · <button class="sm" id="cShareOld">share my ${unshared} earlier session${unshared>1?'s':''}</button>`:''}. New uploads appear in Community after the next hourly update.`
    :'Sharing <b>off</b> — your log stays on this phone only.';
  if($('cFlush'))$('cFlush').onclick=flush;
  if($('cShareOld'))$('cShareOld').onclick=async()=>{for(const s of LOG.filter(s=>s.end!=null&&s.ctx&&!(s.share&&s.share.sid)))await shareSession(s);save();shareInfo();renderList();flush();};}
/* ---- analysis ---- */
const VIEWS=[['score','Predicted score'],['runin','Tide (from run-in start)'],['light','Light'],['moon','Moon phase'],['stretch','Creek stretch'],['sol','Solunar'],['stype','Spot type × stage']];
function bucketOf(v,r){switch(v){
  case 'score':return r.score<20?0:r.score<40?1:r.score<60?2:r.score<80?3:4;
  case 'runin':if(r.ts==='none'||r.tide==='none')return 6;if(r.ri==null)return 5;return r.ri<0?0:r.ri<60?1:r.ri<120?2:r.ri<240?3:r.ri<360?4:5;
  case 'light':return SCH.light.indexOf(r.light);
  case 'moon':return r.mp;
  case 'sol':return SCH.sol.indexOf(r.sol);
  case 'stretch':if(r.sy&&r.sy!=="baffle"){return 'K'+r.sy+'|'+r.band;}return r.bk>=0?(SCH.sides&&SCH.sides[r.ln]?'S'+r.ln+'|'+String(r.bk).padStart(2,'0'):r.bk/2+(r.ln==='E'?100:0)):'R'+r.rg;}}
function bucketLabels(v,rows){switch(v){
  case 'score':return [[0,'0–19'],[1,'20–39'],[2,'40–59'],[3,'60–79'],[4,'80–100']];
  case 'runin':return [[0,'−1–0 h'],[1,'0–1 h'],[2,'1–2 h'],[3,'2–4 h'],[4,'4–6 h'],[5,'6 h+'],[6,'no tide']];
  case 'light':return SCH.light.map((l,i)=>[i,LIGHTN[l]]);
  case 'moon':return PH.map((p,i)=>[i,p]);
  case 'sol':return [[0,'Major'],[1,'Minor'],[2,'None']];
  case 'stretch':{const ks=[...new Set(rows.map(r=>bucketOf('stretch',r)))];ks.sort((a,b)=>(typeof a==='string')-(typeof b==='string')||(typeof a==='string'?a.localeCompare(b):a-b));
    return ks.map(k=>[k,typeof k==='string'?(k[0]==='S'?(((SCH.sides||{})[k.slice(1).split('|')[0]]||[k])[0].replace(/ Creek$/,' Ck')+' km '+(+k.split('|')[1])+'–'+(+k.split('|')[1]+2)):k[0]==='K'?(k.split('|')[0].slice(1)===SYS?'':((FT.sysById&&FT.sysById(k.split('|')[0].slice(1))||{}).name||'')+': ')+k.split('|').slice(1).join('|').replace(/^Off-creek: /,'off '):regionName(k.slice(1)).replace(/ \(.*\)/,'')+' (off)'):(k>=100?'Eu ':'')+'km '+(k%100)*2+'–'+((k%100)*2+2)]);}}}
function aggregate(rows,v){const m=new Map();for(const r of rows){const k=bucketOf(v,r);if(k==null||k===-1)continue;let a=m.get(k);if(!a)m.set(k,a={h:0,bites:0,fish:0,mj:0,ss:new Set(),an:new Set(),sc:0});
  a.h+=0.25;a.bites+=r.bites;a.fish+=r.fish;a.mj+=r.mj;a.ss.add(r.anon+'|'+r.sid);a.an.add(r.anon);a.sc+=r.score;}return m;}
function barChart(rows,v,opts){const labs=bucketLabels(v,rows),A=aggregate(rows,v);const W=420,H=230,L=34,R=6,T=24,B=50,pw=W-L-R,ph=H-T-B;
  const data=labs.map(([k,l])=>{const a=A.get(k);return{l,h:a?a.h:0,bites:a?a.bites:0,fish:a?a.fish:0,n:a?a.ss.size:0,rate:a&&a.h?a.bites/a.h:0,frate:a&&a.h?a.fish/a.h:0,msc:a&&a.h?a.sc/(a.h*4):null};});
  const tot=rows.length/4,totB=rows.reduce((s,r)=>s+r.bites,0),mean=rows.length?rows.reduce((s,r)=>s+r.score,0)/rows.length:50;
  let exp=null;if(v==='score'&&tot>0)exp=data.map((d,i)=>totB/tot*((d.msc!=null?d.msc:i*20+10)/Math.max(5,mean)));
  const mx=Math.max(0.5,...data.map(d=>d.rate),...(exp||[]))*1.15;const bw=pw/data.length;const y=r=>T+ph-r/mx*ph;
  let o=`<svg class="cchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.title)}">`;
  for(let i=0;i<=4;i++){const r=mx*i/4;o+=`<line x1="${L}" x2="${W-R}" y1="${y(r)}" y2="${y(r)}" stroke="#25464b"/><text x="${L-4}" y="${y(r)+4}" fill="#9db5b1" font-size="11" text-anchor="end">${r.toFixed(r<2?2:1)}</text>`;}
  o+=`<text x="${L}" y="14" fill="#9db5b1" font-size="11">bites / hour fished · dark = landed · hours under bars</text>`;
  data.forEach((d,i)=>{const x=L+i*bw+bw*0.15,w=bw*0.7,low=d.h<1;
    if(d.h>0){o+=`<rect x="${x}" y="${y(d.rate)}" width="${w}" height="${T+ph-y(d.rate)}" rx="3" fill="${v==='score'?scoreColor(i*20+10):'#b48cff'}" opacity="${low?0.35:0.9}"><title>${esc(d.l)}: ${d.bites} bites, ${d.fish} landed in ${d.h.toFixed(2)} h (${d.n} session${d.n===1?"":"s"})</title></rect>`;
      o+=`<rect x="${x+w*0.25}" y="${y(d.frate)}" width="${w*0.5}" height="${T+ph-y(d.frate)}" fill="#0b1a1c" opacity=".55"/>`;
      o+=`<text x="${x+w/2}" y="${y(d.rate)-4}" fill="#e8f1ef" font-size="11" text-anchor="middle">${d.rate.toFixed(2)}</text>`;}
    o+=`<text x="${x+w/2}" y="${T+ph+15}" fill="#e8f1ef" font-size="${data.length>8?9:11}" text-anchor="middle">${esc(d.l)}</text><text x="${x+w/2}" y="${T+ph+29}" fill="#9db5b1" font-size="10" text-anchor="middle">${d.h?d.h.toFixed(d.h<10?2:0)+' h':'—'}${d.n?' · '+d.n+'s':''}</text>`;});
  if(exp){o+=`<polyline fill="none" stroke="#fff" stroke-dasharray="5 4" stroke-width="1.5" points="${exp.map((e,i)=>`${L+i*bw+bw/2},${y(e)}`).join(' ')}"/>`;
    o+=`<text x="${W-R}" y="${T+ph+44}" fill="#9db5b1" font-size="10" text-anchor="end">dashed = expected if rate ∝ predicted score</text>`;}
  return o+'</svg>';}
function scatter(rows){const S=new Map();for(const r of rows){const k=r.anon+'|'+r.sid;let a=S.get(k);if(!a)S.set(k,a={h:0,b:0,sc:0});a.h+=0.25;a.b+=r.bites;a.sc+=r.score;}
  const P=[...S.values()].map(a=>({x:a.sc/(a.h*4),y:a.b/a.h,h:a.h}));if(P.length<2)return '';
  const W=420,H=190,L=34,R=8,T=18,B=34,pw=W-L-R,ph=H-T-B;const my=Math.max(0.5,...P.map(p=>p.y))*1.1;const X=x=>L+x/100*pw,Y=v=>T+ph-v/my*ph;
  let o=`<svg class="cchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions: bites per hour vs mean predicted score"><text x="${L}" y="12" fill="#9db5b1" font-size="11">sessions: bites/h vs mean predicted score (size = hours)</text>`;
  for(let s=0;s<=100;s+=20)o+=`<line x1="${X(s)}" x2="${X(s)}" y1="${T}" y2="${T+ph}" stroke="#25464b"/><text x="${X(s)}" y="${T+ph+14}" fill="#9db5b1" font-size="10" text-anchor="middle">${s}</text>`;
  o+=`<text x="${L+pw/2}" y="${H-4}" fill="#9db5b1" font-size="10" text-anchor="middle">mean predicted score</text><text x="${L-4}" y="${Y(my/1.1)+4}" fill="#9db5b1" font-size="10" text-anchor="end">${(my/1.1).toFixed(1)}</text><text x="${L-4}" y="${Y(0)}" fill="#9db5b1" font-size="10" text-anchor="end">0</text>`;
  for(const p of P)o+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${Math.min(12,3+Math.sqrt(p.h)*2.5)}" fill="${scoreColor(p.x)}" fill-opacity=".65" stroke="#fff" stroke-width=".6"><title>${p.x.toFixed(0)} score · ${p.y.toFixed(2)} bites/h · ${p.h.toFixed(2)} h</title></circle>`;
  // effort-weighted correlation
  const sw=P.reduce((s,p)=>s+p.h,0),mx=P.reduce((s,p)=>s+p.h*p.x,0)/sw,myy=P.reduce((s,p)=>s+p.h*p.y,0)/sw;
  const cov=P.reduce((s,p)=>s+p.h*(p.x-mx)*(p.y-myy),0),vx=P.reduce((s,p)=>s+p.h*(p.x-mx)**2,0),vy=P.reduce((s,p)=>s+p.h*(p.y-myy)**2,0);
  const r=vx>0&&vy>0?cov/Math.sqrt(vx*vy):null;
  return o+'</svg>'+(r!=null?`<p class="mut" style="margin:2px 0 8px">Effort-weighted correlation, session score vs bite rate: <b>r = ${r.toFixed(2)}</b> (n = ${P.length} sessions${P.length<15?' — too few to judge yet':''}).</p>`:'');}
function nums(rows,extra){const S=new Set(rows.map(r=>r.anon+'|'+r.sid)),A=new Set(rows.map(r=>r.anon));const b=rows.reduce((s,r)=>s+r.bites,0),f=rows.reduce((s,r)=>s+r.fish,0),mj=rows.reduce((s,r)=>s+r.mj,0),h=rows.length/4;
  const nb=[...S].filter(k=>!rows.some(r=>r.anon+'|'+r.sid===k&&r.bites>0)).length;
  return `<div class="cnums">${extra?`<div><b>${A.size}</b><small>anglers</small></div>`:''}<div><b>${S.size}</b><small>sessions</small></div><div><b>${h.toFixed(h<10?1:0)}</b><small>hours fished</small></div><div><b>${b}</b><small>bites</small></div><div><b>${f}</b><small>landed</small></div><div><b>${mj}</b><small>jacks</small></div><div><b>${h?(b/h).toFixed(2):'—'}</b><small>bites / h</small></div><div><b>${nb}</b><small>no-bite sessions</small></div></div>`;}
function renderCharts(rows,viewKey,elV,elC,extra){let v=LS.get(K.view,{})[viewKey]||'score';
  elV.innerHTML=VIEWS.map(([k,l])=>`<button data-v="${k}" class="${k===v?'on':''}">${l}</button>`).join('');
  elV.querySelectorAll('button').forEach(b=>b.onclick=()=>{const o=LS.get(K.view,{});o[viewKey]=b.dataset.v;LS.set(K.view,o);renderCharts(rows,viewKey,elV,elC,extra);});
  const coR=rows.filter(r=>r.co),coF=coR.reduce((a,r)=>a+r.bites,0),coS=new Set(coR.map(r=>r.anon+'|'+r.sid)).size;rows=rows.filter(r=>!r.co);
  const coN=coS?`<p class="mut" style="margin:2px 0 6px">+ <b>${coS}</b> catch-only entr${coS>1?'ies':'y'} (${coF} bite${coF===1?'':'s'}/fish) — presence-only: not counted as hours fished or in the rates below, so they don’t make the rest of the time look bad.</p>`:'';
  if(!rows.length){elC.innerHTML=nums(rows,extra)+coN+'<div class="cempty">No timed sessions yet.</div>';return;}
  elC.innerHTML=nums(rows,extra)+coN+(v==='stype'?stypeTable(rows):barChart(rows,v,{title:'Catch rate by '+v})+(v==='score'?scatter(rows):''));}
/* bite rate by spot type (rows) vs the tide stage fished (columns) */
const STN={ri:'Run-in',tot:'Top of tide',bot:'Bottom of tide',ro:'Run-out','':'General / untyped'},STGN={ri:'Run-in start (0–2 h)',flood:'Mid–late run-in',tot:'Top / high turn',ro:'Run-out',bot:'Bottom / low turn'};
function stypeTable(rows){const R=rows.filter(r=>r.stg&&r.ts!=='none');const ty=['ri','tot','bot','ro',''].filter(t=>R.some(r=>(r.st||'')===t));const sg=SCH.stage;
  if(!R.length)return '<div class="cempty">No tide-stage data yet — sessions logged from this version on record the stage the creek was at each 15 min, and the spot’s type (set it on the Map tab).</div>';
  const A={};for(const r of R){const k=(r.st||'')+'|'+r.stg;const a=A[k]||(A[k]={h:0,b:0,f:0});a.h+=0.25;a.b+=r.bites;a.f+=r.fish;}
  const mx=Math.max(0.5,...Object.values(A).filter(a=>a.h>=0.5).map(a=>a.b/a.h));
  let o='<div class="sttab"><table><thead><tr><th>Spot type ↓ / stage fished →</th>'+sg.map(g=>`<th>${STGN[g]}</th>`).join('')+'</tr></thead><tbody>';
  for(const t of ty){o+=`<tr><th>${STN[t]}</th>`+sg.map(g=>{const a=A[t+'|'+g];if(!a)return '<td class="mut">—</td>';const r=a.b/a.h,low=a.h<1;
    return `<td style="background:rgba(180,140,255,${(low?0.12:0.15+0.6*Math.min(1,r/mx)).toFixed(2)})" title="${a.b} bites, ${a.f} landed in ${a.h.toFixed(2)} h"><b>${r.toFixed(2)}</b><small>${a.h.toFixed(a.h<10?2:0)} h</small></td>`;}).join('')+'</tr>';}
  return o+'</tbody></table></div><p class="mut" style="margin:4px 0 8px">Bites per hour fished in each cell (hours underneath; faded = under 1 h, too little to judge). Shows whether your run-in spots really fire on the run-in, your run-out spots on the run-out, etc.</p>';}
function myRows(){return LOG.filter(s=>s.end!=null).flatMap(s=>rowsOf(s,'me'));}
function renderMine(){const rows=myRows();$('cMySum').textContent=rows.length?`· ${(rows.length/4).toFixed(1)} h logged`:'';renderCharts(rows,'my',$('cMyViews'),$('cMyCharts'),false);}
/* ---- bulk import of historical catches (simple CSV) ----
   header (any order, case-insensitive): date,time,spot,system,km,line,caught,count,size,species,hours,notes */
function parseRoughDate(v){v=String(v||'').trim();let m;
  if(m=/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(v))return [+m[1],+m[2],+m[3]];
  if(m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/.exec(v)){let y=+m[3];if(y<100)y+=y<50?2000:1900;return [y,+m[2],+m[1]];}
  const MO=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  if(m=/^(\d{1,2})\s*([a-z]{3})[a-z]*\.?\s*(\d{2,4})$/i.exec(v)){let y=+m[3];if(y<100)y+=y<50?2000:1900;const mo=MO.indexOf(m[2].toLowerCase());if(mo>=0)return [y,mo+1,+m[1]];}
  return null;}
/* → {min (minutes after local midnight), rough} ; tolerant: 18:30, 6.30pm, 6pm, ~7am, 0630, dawn, dusk, morning, arvo, night, blank */
function parseRoughTime(v){v=String(v||'').trim().toLowerCase().replace(/^(~|about|approx\.?|around|ca\.?)\s*/,'');let rough=/~|ish|approx|about|around/.test(v);v=v.replace(/ish$/,'').trim();let m;
  const W={dawn:330,sunrise:360,'early morning':330,morning:420,am:420,midday:720,noon:720,lunch:720,afternoon:900,arvo:900,pm:900,evening:1080,dusk:1080,sunset:1080,night:1260,'late night':1380,midnight:0};
  if(!v)return{min:420,rough:true};if(W[v]!=null)return{min:W[v],rough:true};
  if(m=/^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a|p)?$/.exec(v)){let h=+m[1],mi=+(m[2]||0);const ap=m[3];if(ap){h%=12;if(ap[0]==='p')h+=12;}if(h>23||mi>59)return null;return{min:h*60+mi,rough:rough||!m[2]&&!ap&&false};}
  if(m=/^(\d{2})(\d{2})$/.exec(v)){const h=+m[1],mi=+m[2];if(h>23||mi>59)return null;return{min:h*60+mi,rough};}
  return null;}
function spotFromName(nm,km,line){const L=BT.LANDMARKS;nm=(nm||'').trim();
  if(km!=null&&!isNaN(km)){const ln=line||(GEN?'M':'B');const mx=BT.lineMaxKm?BT.lineMaxKm(ln):BT.MAXKM;if(km<0||km>mx+1e-6)return null;
    const p=GEN?BT.pointOnLine(km,ln):(ln==='B'?BT.pointAtKm(km):(FT.spots&&FT.spots.pointAt?FT.spots.pointAt(km,ln):BT.pointAtKm(km)));
    const sp=spotFromLatLng(p[0],p[1],null,'landmark',nm||('km '+km));sp.km=+(+km).toFixed(2);sp.line=ln;if(GEN)sp.lineName=BT.lineName(ln);return sp;}
  if(!nm)return null;const lo=nm.toLowerCase();
  const l=L.find(l=>l.name.toLowerCase()===lo)||L.find(l=>l.name.toLowerCase().includes(lo))||L.find(l=>lo.includes(l.name.toLowerCase()));
  return l?landmarkSpot(l):null;}
function importSimple(H,A){const h=H.map(x=>x.toLowerCase().replace(/[^a-z]/g,''));const col=(...ks)=>{for(const k of ks){const i=h.indexOf(k);if(i>=0)return i;}return -1;};
  const C={date:col('date','day'),time:col('time','start','starttime'),spot:col('spot','location','place','spotname'),sys:col('system','creek','river'),km:col('km','creekkm'),line:col('line','channel'),
    caught:col('caught','catch','success','fish'),count:col('count','n','number','qty'),size:col('size','length','lengthcm','sizecm','len'),sp:col('species'),hrs:col('hours','duration','hrs'),note:col('notes','note','comment','comments'),col:col('colour','color','lurecolour','lurecolor','lure')};
  if(C.date<0)throw new Error('not a catch CSV — need at least a "date" column (date,time,spot,caught,count,size,notes)');
  let added=0,skipped=0;const errs=[],other={};const seen=new Set(LOG.map(s=>s.imp).filter(Boolean));
  A.forEach((a,ri)=>{const g=i=>i<0?'':String(a[i]||'').trim();if(!a.some(x=>String(x).trim()))return;const bad=m=>{skipped++;if(errs.length<8)errs.push(`row ${ri+2}: ${m}`);};
    const sy=g(C.sys).toLowerCase();if(sy&&FT.sysById){const me=FT.sysById(SYS);const hit=[SYS,me&&me.name,me&&me.short].filter(Boolean).some(x=>String(x).toLowerCase().includes(sy)||sy.includes(String(x).toLowerCase().replace(/ (creek|river)$/,'')));
      if(!hit){other[sy]=(other[sy]||0)+1;skipped++;return;}}
    const d=parseRoughDate(g(C.date));if(!d)return bad('date “'+g(C.date)+'” not understood');
    const tm=parseRoughTime(g(C.time));if(!tm)return bad('time “'+g(C.time)+'” not understood');
    const dd=new Date(Date.UTC(d[0],d[1]-1,d[2]));if(dd.getUTCMonth()!==d[1]-1||dd.getUTCDate()!==d[2])return bad('date “'+g(C.date)+'” doesn’t exist');const start=Date.UTC(d[0],d[1]-1,d[2],0,tm.min)-AEST;if(isNaN(start))return bad('bad date');
    let hrs=parseFloat(g(C.hrs));const hasH=hrs>0&&hrs<=16;if(!hasH)hrs=2;let end=start+Math.round(hrs*4)*Q;
    const kmv=g(C.km)!==''?parseFloat(g(C.km)):null;let ln=g(C.line);if(ln&&!GEN&&BT.channels){}
    if(ln&&FT.spots&&FT.spots.channels){const c=FT.spots.channels().find(c=>c.id.toLowerCase()===ln.toLowerCase()||c.name.toLowerCase().includes(ln.toLowerCase()));ln=c?c.id:'';}
    let kmx=kmv;if(kmx!=null&&ln&&FT.spots&&FT.spots.channels){const c=FT.spots.channels().find(c=>c.id===ln);if(c&&!c.main&&kmx<c.min)kmx=+(c.min+kmx).toFixed(2);} /* side-creek km may be given from its junction */
    const sp=spotFromName(g(C.spot),kmx,ln||null);if(!sp)return bad('spot “'+(g(C.spot)||'')+'”'+(kmv!=null?' / km '+kmv:'')+' not found — use a landmark/My-spot name or a km');
    const cv=g(C.caught).toLowerCase();let n=parseInt(g(C.count),10);const yes=/^(y|yes|true|1|caught)/.test(cv)||(!cv&&n>0);if(!(n>0))n=yes?1:0;if(!yes)n=0;n=Math.min(20,n);
    let len=null;const sz=g(C.size).toLowerCase();const sm=/([\d.]+)\s*(cm|mm|in|inch|")?/.exec(sz);if(sm){len=+sm[1];if(sm[2]==='mm')len/=10;if(sm[2]&&/in|"/.test(sm[2]))len*=2.54;len=len>=1&&len<=150?Math.round(len*2)/2:null;}
    const spc=(()=>{const v=g(C.sp).toLowerCase();if(!v)return 'MJ';const f=SCH.species.find(([c,l])=>c.toLowerCase()===v||l.toLowerCase().includes(v)||v.includes(l.toLowerCase()));return f?f[0]:'OT';})();
    const key=[d.join('-'),tm.min,sp.km,sp.name,n,len,g(C.note)].join('|');if(seen.has(key)){skipped++;return;}
    const co=!hasH&&n>0;const st0=co?Math.round(start/Q)*Q-Q:start;if(co)end=st0+2*Q;
    const s={id:rid(8),tok:rid(12),v:1,start:st0,end,co:co?1:undefined,spot:sp,bait:{cat:'',txt:''},note:g(C.note).slice(0,500),noBites:!n,catches:[],ctx:null,share:{st:'local'},imp:key,rough:tm.rough||undefined};
    if(n)s.catches.push({id:rid(6),t:co?start:Math.min(end-Q,start+Q),sp:spc,n,len,fate:'released',note:'',...(g(C.col)?{colour:g(C.col).slice(0,40)}:{})});
    const err=validate(s);if(err)return bad(err);
    s.ctx=computeCtx(s);s.saved=Date.now();LOG.push(s);seen.add(key);added++;});
  save();const o=Object.entries(other);
  return{added,skipped,spots:0,errs,other:o.length?o.map(([k,v])=>`${v}× “${k}”`).join(', ')+' — switch to that system and import the file there':''};}
/* ---- community ---- */
let COM=null,comAt=0;
function parseCSV(txt){const out=[];let row=[],f='',q=false;for(let i=0;i<txt.length;i++){const c=txt[i];
  if(q){if(c==='"'){if(txt[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
  else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(f);f='';if(row.length>1||row[0]!=='')out.push(row);row=[];}else f+=c;}
  if(f!==''||row.length){row.push(f);out.push(row);}return out;}
const csvCell=v=>{v=v==null?'':String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
async function loadCom(force){if(!force&&COM&&Date.now()-comAt<5*60e3){renderCom();return;}
  try{const r=await fetch('data/catches.csv?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const txt=await r.text();
    const A=parseCSV(txt);const H=A.shift()||[];const ix=k=>H.indexOf(k);const num=(x)=>x===''||x==null?null:+x;
    COM={cache:!!r.headers.get('x-ft-cache'),rows:A.filter(a=>a.length>=H.length-1).map(a=>{const g=k=>a[ix(k)];const t=Date.parse(g('slot_start'));
      return{anon:g('anon'),sid:g('session'),t,bk:g('band_km')===''?-1:+g('band_km'),ln:g('line')||'',rg:g('region')||'',band:g('band'),score:+g('score'),tide:g('tide'),ri:num(g('min_from_runin')),light:g('light'),sol:g('solunar'),
        mp:Math.max(0,PH.findIndex(p=>p===g('moon_phase'))),ts:g('tide_source'),wind:num(g('wind_kmh')),dp3:num(g('dp3_hpa')),bites:+g('bites')||0,fish:+g('fish')||0,mj:+g('mj')||0,kept:+g('kept')||0,ml:num(g('max_len_cm')),sp:(g('species')||'').split(';').filter(Boolean),bait:g('bait'),sy:g('system')||'baffle',stg:g('stage')||'',st:g('spot_type')||'',hi:g('historical')==='y',co:g('catch_only')==='y'};}).filter(r=>!isNaN(r.t))};
    comAt=Date.now();}
  catch(e){if(!COM){$('cComHead').innerHTML=`<div class="notice err">Couldn’t load community data (${esc(e.message)}). Connect once to cache it.</div>`;return;}}
  // mark my shared sessions that made it into the table; resend if lost
  const sids=new Set(COM.rows.map(r=>r.sid));let ch=false;
  for(const s of LOG){const sh=s.share;if(!sh||!sh.sid)continue;if(sids.has(sh.sid)){if(sh.st!=='published'){sh.st='published';ch=true;}}
    else if(sh.st==='published'||(sh.st==='sent'&&Date.now()-sh.at>6*3600e3&&(sh.tries||0)<3&&Date.now()-s.end<10*864e5)){if(SH.on){await shareSession(s);ch=true;}}}
  if(ch){save();flush();}
  renderCom();}
function renderCom(){if(!COM)return;const all=LS.get('mbj_comall',0);const rows0=COM.rows.filter(r=>isTest()||!/^TEST/.test(r.anon));const rows=all?rows0:rows0.filter(r=>(r.sy||'baffle')===SYS);
  const tests=COM.rows.length-rows0.length;
  $('cComSum').textContent=rows.length?`· ${new Set(rows.map(r=>r.anon)).size} angler(s)`:'';
  $('cComHead').innerHTML=(COM.cache?'<div class="notice">📦 Offline copy of the community table.</div>':'')+`<div class="row" style="margin:4px 0"><span class="mut">Show:</span> <button class="sm${all?'':' pri'}" id="cComThis">${esc(FT.SYSSHORT||'Baffle Ck')} only</button><button class="sm${all?' pri':''}" id="cComAll">all river systems (${new Set(rows0.map(r=>r.sy||'baffle')).size})</button></div>`;
  $('cComThis').onclick=()=>{LS.set('mbj_comall',0);renderCom();};$('cComAll').onclick=()=>{LS.set('mbj_comall',1);renderCom();};
  renderCharts(rows,'com',$('cComViews'),$('cComCharts'),true);
  $('cComNote').innerHTML=`Anonymous sessions shared by app users (creek stretch only), validated & merged hourly into <a href="https://github.com/JonathanAgronica/fishing-apps/blob/main/data/catches.csv" target="_blank" rel="noopener">data/catches.csv</a>. Rates use 15-minute slots of time actually fished, so “no bites” sessions count. Faded bars = under 1 h of effort — treat as anecdotes.${tests?` (${tests} TEST rows hidden)`:''}`;
  {const hs=new Set(rows.filter(r=>r.hi).map(r=>r.anon+'|'+r.sid)).size;if(hs)$('cComNote').innerHTML+=` <span class="ctag">${hs} historical session${hs>1?'s':''}</span> (logged >1 yr after the trip — tide/moon/sun from the model, weather unknown).`;}
  shareInfo();renderList();}
/* ---- CSV export / import (personal, full detail incl. GPS — stays on the phone) ---- */
const COLS=['record','session_id','event_id','start_aest','end_aest','time_aest','spot_kind','spot_name','lat','lng','gps_acc_m','creek_km','creek_line','share_band','species','count','length_cm','fate','bait_type','bait','note','no_bites','pred_score','pred_score_avg','pred_score_max','tide_stage','min_from_runin','light','solunar','moon_phase','moon_illum','tide_source','wind_kmh','pressure_hpa','pressure_3h_hpa','cloud_pct','sst_c','shared','ctx_json','spot_id','color','system','spot_type','stage','lure_colour'];
function slotAt(s,t){const sl=s.ctx&&s.ctx.slots;if(!sl||!sl.length)return null;let i=Math.floor((t-sl[0].t)/Q);i=Math.max(0,Math.min(sl.length-1,i));return sl[i];}
function exportCSV(){const out=[COLS.join(',')];
  for(const s of LOG.filter(s=>s.end!=null).sort((a,b)=>a.start-b.start)){const sp=s.spot||{},b=shareBand(s.spot),c=s.ctx,sl=c?c.slots:[];
    const base={session_id:s.id,start_aest:isoA(s.start),end_aest:isoA(s.end),spot_kind:sp.kind,spot_name:sp.name,lat:sp.lat,lng:sp.lng,gps_acc_m:sp.acc,creek_km:sp.km,creek_line:sysOf(sp)!=='baffle'?(sp.km!=null?(sp.lineName||sp.line):''):sp.line==='E'?'Euleilah':(SCH.sides&&SCH.sides[sp.line])?SCH.sides[sp.line][0]:sp.km!=null?'Baffle':'',share_band:b?b.label:'',system:sysOf(sp),bait_type:s.bait&&s.bait.cat,bait:s.bait&&s.bait.txt,
      moon_phase:c?PH[phIdx(c.moon.phase)]:'',moon_illum:c?c.moon.illum:'',tide_source:c?c.tideSrc:'',spot_type:stOf(s)};
    const ctxCols=x=>x?{pred_score:x.score,tide_stage:tideOf(x,c.tideSrc),min_from_runin:x.ri,light:lightOf(x.alt,x.t),solunar:x.sol,wind_kmh:x.wind,pressure_hpa:x.p,pressure_3h_hpa:x.dp3,cloud_pct:x.cloud,sst_c:x.sst,stage:x.stg||''}:{};
    const rec=o=>COLS.map(k=>csvCell(o[k])).join(',');
    out.push(rec({...base,...ctxCols(sl[0]),record:'session',note:s.note,no_bites:s.noBites?1:0,pred_score_avg:sl.length?Math.round(sl.reduce((a,x)=>a+x.score,0)/sl.length):'',pred_score_max:sl.length?Math.max(...sl.map(x=>x.score)):'',
      shared:s.share&&s.share.st||'',ctx_json:c?JSON.stringify(c):''}));
    for(const x of (s.catches||[]).slice().sort((a,b)=>a.t-b.t))out.push(rec({...base,...ctxCols(slotAt(s,x.t)),record:'catch',event_id:x.id,time_aest:isoA(x.t),species:SPN[x.sp]||x.sp,count:x.n,length_cm:x.len,fate:x.fate,note:x.note,lure_colour:x.colour||''}));}
  if(FT.spots){const X=FT.spots.exportData();const rec=o=>COLS.map(k=>csvCell(o[k])).join(',');
    for(const c of X.spots)out.push(rec({record:'spot',spot_id:c.id,spot_kind:'custom',spot_name:c.name,lat:c.lat,lng:c.lng,creek_km:c.km,creek_line:(c.sys||'baffle')!=='baffle'?c.line:c.line==='E'?'Euleilah':(SCH.sides&&SCH.sides[c.line])?SCH.sides[c.line][0]:'Baffle',note:c.note,color:c.color,spot_type:c.type||'',system:c.sys||'baffle',start_aest:isoA(c.created||Date.now())}));
    for(const [k,v] of Object.entries(X.alias))out.push(rec({record:'alias',spot_id:k,spot_name:v}));}
  const blob=new Blob([out.join('\n')+'\n'],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='macs-jacks-catch-log-'+toLocalInput(Date.now()).slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
  $('cIoMsg').textContent=`Exported ${LOG.filter(s=>s.end!=null).length} sessions.`;window.__MBJ_LAST_EXPORT=out.join('\n');}
function lineFromCsv(v){if(v==='Euleilah')return 'E';if(SCH.sides)for(const k in SCH.sides)if(SCH.sides[k][0]===v)return k;return 'B';}
function importCSV(txt){const A=parseCSV(txt.replace(/^\uFEFF/,''));const H=(A.shift()||[]).map(h=>h.trim());if(!H.includes('record')||!H.includes('session_id'))return importSimple(H,A);
  const g=(a,k)=>{const i=H.indexOf(k);return i<0?'':a[i]||'';};const spCode=n=>{const f=SCH.species.find(([c,l])=>l===n||c===n);return f?f[0]:'OT';};
  const S=new Map();let added=0,skipped=0,spots=0;
  if(FT.spots){const X={spots:[],alias:{}};for(const a of A){const r=g(a,'record');
      if(r==='spot'){const lat=+g(a,'lat'),lng=+g(a,'lng');if(!isNaN(lat)&&!isNaN(lng))X.spots.push(Object.assign({id:g(a,'spot_id'),name:g(a,'spot_name'),lat,lng,note:g(a,'note'),color:g(a,'color'),created:fromLocalInput(g(a,'start_aest'))},(g(a,'system')||'baffle')!=='baffle'?{sys:g(a,'system'),km:+g(a,'creek_km')||0,line:g(a,'creek_line')||'M'}:{}));}
      else if(r==='alias')X.alias[g(a,'spot_id')]=g(a,'spot_name');}
    if(X.spots.length||Object.keys(X.alias).length)spots=FT.spots.importData(X);}
  for(const a of A){const id=g(a,'session_id').replace(/[^\w-]/g,'').slice(0,24);if(!id)continue;
    if(g(a,'record')==='session'){const lat=+g(a,'lat'),lng=+g(a,'lng');if(isNaN(lat)||isNaN(lng)){skipped++;continue;}
      let sp=spotFromLatLng(lat,lng,g(a,'gps_acc_m')?+g(a,'gps_acc_m'):null,g(a,'spot_kind')||'gps',g(a,'spot_name').slice(0,80));
      const sy=g(a,'system')||'baffle';
      if(sy!==SYS){sp={kind:g(a,'spot_kind')||'gps',lat,lng,acc:g(a,'gps_acc_m')?+g(a,'gps_acc_m'):null,name:g(a,'spot_name').slice(0,80),km:g(a,'creek_km')!==''?+g(a,'creek_km'):null,line:null,offKm:null};
        if(sy!=='baffle'){sp.sys=sy;sp.lineName=g(a,'creek_line');sp.line=null;}else if(sp.km!=null)sp.line=lineFromCsv(g(a,'creek_line'));}
      else if(g(a,'creek_km')!==''&&sp.km==null){sp.km=+g(a,'creek_km');sp.line=GEN?'M':lineFromCsv(g(a,'creek_line'));}
      let ctx=null;try{ctx=g(a,'ctx_json')?JSON.parse(g(a,'ctx_json')):null;if(ctx&&!Array.isArray(ctx.slots))ctx=null;}catch(e){}
      S.set(id,{id,tok:rid(12),v:1,start:fromLocalInput(g(a,'start_aest')),end:fromLocalInput(g(a,'end_aest')),spot:sp,bait:{cat:SCH.bait.some(b=>b[0]===g(a,'bait_type'))?g(a,'bait_type'):'',txt:g(a,'bait').slice(0,120)},note:g(a,'note').slice(0,500),noBites:g(a,'no_bites')==='1',catches:[],ctx,share:{st:'local'}});}}
  for(const a of A){if(g(a,'record')!=='catch')continue;const s=S.get(g(a,'session_id'));if(!s)continue;const t=fromLocalInput(g(a,'time_aest'));if(t==null)continue;
    const len=+g(a,'length_cm');s.catches.push({id:g(a,'event_id').slice(0,16)||rid(6),t,sp:spCode(g(a,'species')),n:Math.max(1,Math.min(20,+g(a,'count')||1)),len:len>=1&&len<=150?len:null,fate:FATEN[g(a,'fate')]?g(a,'fate'):'released',note:g(a,'note').slice(0,200),...(g(a,'lure_colour')?{colour:g(a,'lure_colour').slice(0,40)}:{})});}
  for(const s of S.values()){if(byId(s.id)||validate(s)){skipped++;continue;}if(!s.ctx)s.ctx=computeCtx(s);LOG.push(s);added++;}
  save();return{added,skipped,spots};}
/* ---- wiring ---- */
function renderAll(){renderActive();renderList();renderMine();shareInfo();if(COM)renderCom();}
function init(){fillSelects();
  $('cShareOn').checked=!!SH.on;
  $('cShareOn').onchange=()=>{SH.on=$('cShareOn').checked;LS.set(K.share,SH);shareInfo();renderList();if(SH.on)flush();};
  $('cStart').onclick=()=>{const go=()=>{if(activeS())return;const s=newSession(Date.now(),null);LOG.push(s);save();renderAll();if(!s.spot)openForm(s,'active');};
    if(!curSpot||curSpot.kind==='gps'){$('cStart').disabled=true;gps(()=>{$('cStart').disabled=false;go();},()=>{$('cStart').disabled=false;go();});}else go();};
  $('cQuick').onclick=()=>{const now=Date.now();const s=newSession(now-Q,now);openForm(s,'new');$('cFormTitle').textContent='Quick catch (15-min session)';};
  $('cPastBtn').onclick=()=>{const now=Math.floor(Date.now()/Q)*Q;openForm(newSession(now-3*3600e3,now),'new');};
  $('cGps').onclick=()=>gps();$('cBiteSpot').onclick=biteSpot;
  $('cSpotSel').onchange=()=>{const v=$('cSpotSel').value;if(!v||v==='cur')return;
    if(v[0]==='L'){const l=BT.LANDMARKS[+v.slice(1)];nameTyped=false;setSpot(landmarkSpot(l));}
    else{const g=SCH.regions.find(x=>x[0]===v.slice(1));const sp={kind:'region',rg:g[0],lat:g[2],lng:g[3],acc:null,name:'',km:null,line:null,offKm:null};setSpot(sp);}};
  $('cSpotName').oninput=()=>{nameTyped=!!$('cSpotName').value.trim();};
  $('cNoBites').onchange=$('cYesBites').onchange=()=>{if(F){F.noBites=$('cNoBites').checked;setCaught(F.noBites?'n':'y');catchUI();}};
  $('cCtNow').onclick=()=>$('cCt').value=toLocalInput(Date.now());
  $('cAddCatch').onclick=addCatch;
  $('cCancel').onclick=closeForm;
  ['input','change'].forEach(ev=>$('cFormCard').addEventListener(ev,()=>{$('cFormMsg').textContent='';}));
  $('cCatchOnlyBtn').onclick=()=>{const now=Math.floor(Date.now()/Q)*Q;openForm(newSession(now-Q,now+Q),'catch');};
  $('cSave').onclick=async()=>{readForm();const s=F;if(s.co&&!(s.catches||[]).length){if(!$('cFormMsg').textContent)$('cFormMsg').textContent='⚠ Add the catch first.';else $('cFormMsg').textContent='⚠ '+$('cFormMsg').textContent.replace(/^⚠ /,'');return;}
    {const e0=s.end!=null&&validate(s);if(e0){$('cFormMsg').textContent='⚠ '+e0;return;}}
    if(s.end!=null&&!s.co&&!s.noBites&&!(s.catches||[]).length){$('cFormMsg').textContent=($('cYesBites').checked?'⚠ You chose “Yes” but added no fish — add it, or choose “No — blank session”.':'⚠ Caught anything? Choose “Yes” (and add the fish) or “No — blank session”.');return;}delete s._mode;const mode=$('cFormTitle').textContent;
    if(s.end==null){const err=validate(s);if(err){$('cFormMsg').textContent='⚠ '+err;return;}const o=byId(s.id);if(o)LOG[LOG.indexOf(o)]=s;else LOG.push(s);save();closeForm();renderAll();return;}
    if(await commit(s)){closeForm();renderAll();flush();}};
  $('cExport').onclick=exportCSV;
  $('cImport').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const r=importCSV(await f.text());$('cIoMsg').innerHTML=esc(`Imported ${r.added} session(s)${r.spots?`, ${r.spots} spot(s)`:''}${r.skipped?`, skipped ${r.skipped} (duplicates/invalid/other system)`:''}.`)+(r.errs&&r.errs.length?'<br>'+r.errs.map(esc).join('<br>'):'')+(r.other?'<br>'+esc(r.other):'');renderAll();}catch(err){$('cIoMsg').textContent='Import failed: '+err.message;}e.target.value='';};
  addEventListener('online',flush);
  if(FT.spots)FT.spots.onChange.push(()=>{fillSpotSel();if(F)spotUI();renderList();});
  FT.catchLogAt=l=>{const sp=landmarkSpot(l);curSpot=sp;LS.set('mbj_lastspot',sp);FT.showTab('log');const a=activeS();
    if(a){openForm(a,'active');$('cCt').value=toLocalInput(Date.now());return;}
    const now=Date.now();openForm(newSession(now-Q,now),'new');$('cFormTitle').textContent='Quick catch (15-min session) — '+l.name;};
  renderAll();
  setInterval(()=>{if(document.body.dataset.tab==='log')renderActive();},60e3);
  FT.onTab.push(t=>{if(t==='log'){renderAll();loadCom();flush();}});
  if(document.body.dataset.tab==='log'){loadCom();}
  if(LS.get(K.q,[]).length)flush();
  document.body.dataset.logReady='1';
  FT.catchLog={importCSV,parseRoughTime,parseRoughDate,exportCSV,flush,loadCom,get log(){return LOG;},reload(){LOG=LS.get(K.log,[]);renderAll();}};}
try{init();}catch(e){console.error('catch log init',e);}
})();
