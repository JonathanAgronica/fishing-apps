/* Mac's Yak — kayak fishing planner. Launch, targets, check-in contact, catch log and settings live in this phone's localStorage only. */
(function(){'use strict';
const Y=window.YAK,TZ=Y.TZ,JACKS='https://jonathanagronica.github.io/fishing-apps/';
const $=id=>document.getElementById(id),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get:(k,d)=>{try{const v=localStorage.getItem('macsyak-'+k);return v==null?d:JSON.parse(v);}catch(x){return d}},set:(k,v)=>{try{localStorage.setItem('macsyak-'+k,JSON.stringify(v));}catch(x){}}};
const fmtT=ms=>{const p=tzParts(ms,TZ);return (p.h%12||12)+':'+String(p.mi).padStart(2,'0')+(p.h<12?'am':'pm');};
const fmtH=ms=>{const p=tzParts(ms,TZ);return (p.h%12||12)+(p.h<12?'am':'pm');};
const fmtD=ms=>new Date(ms).toLocaleDateString('en-AU',{timeZone:TZ,weekday:'short',day:'numeric',month:'short'});
const fmtDL=ms=>new Date(ms).toLocaleDateString('en-AU',{timeZone:TZ,weekday:'long',day:'numeric',month:'short'});
const today=()=>ymd(Date.now(),TZ);const dowOf=d=>new Date(d+'T12:00:00Z').getUTCDay();
const DOWN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const bcol=s=>s>=75?'#1d7a45':s>=60?'#4f8a1f':s>=45?'#8a6a12':s>=30?'#8a4a12':'#7a2323';
const light=(l,txt)=>`<span class="light L${l==null?'x':l}">${l==null?'—':Y.EMO[l]+' '+(txt||Y.LV[l])}</span>`;
const PIN=()=>L.divIcon({className:'',html:'<div style="font-size:26px;line-height:26px;transform:translate(-4px,-22px)">📍</div>',iconSize:[18,18]});
const arrow=d=>d==null?'':`<span class="arr" style="transform:rotate(${(d+180)%360}deg)">↑</span>`;
/* ---------- settings ---------- */
const SET=Object.assign({days:[2,4],launchId:'burnett-heads',custom:null,s:{}},LS.get('set',{}));SET.s=Object.assign({},Y.DEFAULTS,SET.s||{});
function spot(){if(SET.launchId==='custom'&&SET.custom)return SET.custom;return Y.LAUNCHES.find(l=>l.id===SET.launchId)||Y.LAUNCHES[0];}
function saveSet(){LS.set('set',SET);pushSW();}
function pushSW(){if(!('caches' in window))return;caches.open('macsyak-settings').then(c=>c.put('./__settings.json',new Response(JSON.stringify({days:SET.days,spot:spot(),s:SET.s,notify:LS.get('notifyOn',false)}),{headers:{'content-type':'application/json'}}))).catch(()=>{});}
/* ---------- data ---------- */
let FC=null,FLOOD=null,FLOODGEN='',DAYS={},P=Y.personal(LS.get('log',[]));
const fcKey=s=>s.lat.toFixed(3)+','+s.lng.toFixed(3);
async function loadFC(force){const s=spot(),c=LS.get('fc',null);
  if(c&&c.key===fcKey(s)&&!force&&Date.now()-c.d.at<45*6e4){FC=c.d;return 'cache';}
  try{FC=await Y.fetchForecast(s,14);LS.set('fc',{key:fcKey(s),d:FC});return 'live';}
  catch(x){if(c&&c.key===fcKey(s)){FC=c.d;return 'stale';}throw x;}}
async function loadFlood(){try{const r=await fetch('../data/flood_state.json',{cache:'no-cache'});if(r.ok){const j=await r.json();FLOOD=j.systems||{};FLOODGEN=j.generated_aest||'';}}catch(x){}}
function analyse(){DAYS={};if(!FC)return;const s=spot();for(const d of Y.dayKeys(FC)){if(d<today())continue;const a=Y.analyseDay(FC,d,s,SET.s,P);if(a&&a.hrs.length>=20)DAYS[d]=a;}}
const dayList=()=>Object.keys(DAYS).sort();
/* ---------- tabs ---------- */
let curDay=null;
function showTab(t){document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x.dataset.t===t));document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.id==='t-'+t));
  if(t==='set')initSpotMap();if(t==='trip'){initTripMap();renderTrip();}if(t==='hours')renderHours();if(t==='fish')renderFish();if(t==='log')renderLog();scrollTo(0,0);}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.t));
function daySel(sel){const v=curDay;sel.innerHTML='';for(const d of dayList()){const a=DAYS[d];sel.add(new Option(`${Y.EMO[a.lvl]} ${d===today()?'Today ':''}${fmtD(a.d0+12*36e5)}${SET.days.includes(dowOf(d))?' ★':''}`,d));}if(v&&DAYS[v])sel.value=v;else if(sel.options.length)curDay=sel.value=nextChosen()||sel.options[0].value;}
['hrDay','fiDay','tpDay'].forEach(id=>$(id).onchange=()=>{curDay=$(id).value;({hrDay:renderHours,fiDay:renderFish,tpDay:renderTrip})[id]();});
function nextChosen(){return dayList().find(d=>SET.days.includes(dowOf(d)))||null;}
/* ---------- Days tab ---------- */
function renderDays(){const s=spot();$('spotName').textContent=s.name;
  $('spotInfo').textContent=`${Y.EXPOSURE[s.exp]}${s.facing!=null?' · faces '+Y.compass(s.facing):''} · kayak days: ${SET.days.length?SET.days.map(d=>DOWN[d]).join(', '):'none set'} · ${SET.s.sessionStart}:00–${SET.s.sessionEnd}:00`;
  const L=dayList();let st='';const first=L[0];if(first){const wd=(dowOf(first)+6)%7;for(let i=0;i<wd;i++)st+='<span></span>';}
  for(const d of L){const a=DAYS[d];st+=`<div data-d="${d}" class="L${a.lvl} ${SET.days.includes(dowOf(d))?'ch':''}"><b>${+d.slice(8)}</b>${DOWN[dowOf(d)]}</div>`;}
  $('strip').innerHTML=st||'<span class="mut">No forecast yet</span>';$('strip').querySelectorAll('[data-d]').forEach(x=>x.onclick=()=>{curDay=x.dataset.d;showTab('hours');});
  renderWQ();
  const ch=L.filter(d=>SET.days.includes(dowOf(d)));
  $('dayList').innerHTML=(ch.length?ch:L.slice(0,2)).map(d=>dayCard(DAYS[d])).join('')+(ch.length?'':`<div class="card mut">No kayak days picked in the next ${L.length} days. Pick them in ⚙️ Setup. Showing the next two days.</div>`);
  $('dayList').querySelectorAll('[data-open]').forEach(x=>x.onclick=()=>{curDay=x.dataset.open;showTab('hours');});}
function dayCard(a){const s=spot(),T=a.turn;const wx=s.exp!=='estuary'&&a.wave!=null?`<div><b>${a.wave.toFixed(1)} m</b><small>max waves</small></div>`:'';
  return `<div class="card dcard l${a.lvl}" data-open="${a.date}"><h3><span>${a.date===today()?'Today, ':''}${fmtDL(a.d0+12*36e5)}</span>${light(a.lvl)}</h3>
  <div class="kv"><div><b>${Math.round(a.wind[0])}–${Math.round(a.wind[1])} kn</b><small>wind (session)</small></div><div><b>${Math.round(a.gust)} kn</b><small>max gust</small></div>${wx}
  <div><b>${a.rainDay!=null?a.rainDay.toFixed(0):'?'} mm</b><small>rain (day)</small></div><div><b>${Math.round(a.tmax)}°C</b><small>top temp</small></div><div><b>UV ${Math.round(a.uvmax)}</b><small>${a.uvmax>=8?'very high':a.uvmax>=6?'high':'moderate'}</small></div>
  <div><b>${a.sunrise?fmtT(a.sunrise):''}</b><small>sunrise</small></div><div><b>${a.sunset?fmtT(a.sunset):''}</b><small>sunset</small></div></div>
  <p>${a.win?`<b>${a.lvl===0?'Best green window':a.lvl===1?'Best (amber) window':'Least-bad window'}: ${fmtT(a.win.t0)}–${fmtT(a.win.t1+36e5)}</b>`:'<b>No usable window in your session hours</b>'}${a.fishWin?` · 🎣 best fishing in it <b>${fmtT(a.fishWin.t0)}–${fmtT(a.fishWin.t1)}</b> (bite ${Math.round(a.fishWin.avg)})`:''}</p>
  ${T?`<p class="${T.by?'cau':''}">💨 ${T.change?`<b>${esc(T.change.kind)}</b> about ${fmtT(T.change.t)} (${T.change.from[0]} ${T.change.from[1]} → ${T.change.to[0]} ${T.change.to[1]} kn)`:''}${T.firstBad?` ${T.change?'·':''} turns ${Y.LV[T.firstBad.lvl].toLowerCase()} from ${fmtT(T.firstBad.t)}`:''}${T.by?` · <b>head back by ${fmtT(T.by)}</b>`:''}</p>`:''}
  <p class="small">🌊 Tides (${esc(PORTS.ports[a.port].name)}): ${a.ext.map(x=>(x.hi?'High ':'Low ')+fmtT(x.t)+' '+x.z.toFixed(1)+' m').join(' · ')}</p>
  <p class="small">🌙 ${phaseEmoji(a.moon.phase,-25)} ${phaseName(a.moon.phase)} · ${a.sol.filter(x=>x.major).map(x=>'major '+fmtT(x.t0)+'–'+fmtT(x.t1)).concat(a.sol.filter(x=>!x.major).map(x=>'minor '+fmtT(x.t0)+'–'+fmtT(x.t1))).join(' · ')}</p>
  ${a.worst.length&&a.lvl>0?`<p class="small mut">Watch: ${a.worst.map(w=>esc(w[1])).join(' · ')}</p>`:''}</div>`;}
function renderWQ(){const s=spot(),sys=s.sys||(Y.nearestSys(s.lat,s.lng)||{}).id;const st=FLOOD&&sys?FLOOD[sys]:null;const W=Y.waterQuality(st,FC);const sg=Y.stinger(Date.now(),s.lat);
  const sn=(window.SYSTEMS.find(x=>x[0]===sys)||[0,sys])[1];
  $('wq').innerHTML=`<div class="card wq"><h3>💧 Water quality</h3>${W.length?W.map(w=>`<p class="${['go','cau','no'][w[0]]}">${esc(w[1])}${w[2]?` <span class="small mut">(${esc(w[2])})</span>`:''}</p>`).join(''):`<p class="go">No recent fresh in ${esc(sn||'this system')}: normal water clarity expected.</p>`}
  ${sg?`<p class="small">🪼 ${esc(sg)} <a href="https://www.qld.gov.au/emergency/safety/recreation/dangerous-marine" target="_blank" rel="noopener">qld.gov.au</a> · <a href="https://lifesaving.com.au/safety-info/marine-stingers" target="_blank" rel="noopener">SLSQ</a></p>`:''}
  <p class="small mut">Fresh/flood state for ${esc(sn||'?')} from <a href="${JACKS}" target="_blank" rel="noopener">Mac's Jacks</a> gauges${FLOODGEN?' ('+esc(FLOODGEN)+')':''}; rain from Open-Meteo.</p></div>`;}
/* ---------- Hours tab ---------- */
function renderHours(){daySel($('hrDay'));const a=DAYS[$('hrDay').value];if(!a){$('hrSum').innerHTML='<p class="mut">No forecast loaded.</p>';$('hrTable').innerHTML='';return;}curDay=a.date;
  $('hrSum').innerHTML=dayCard(a).replace('class="card dcard','class="dcard').replace(/data-open="[^"]*"/,'');
  const s=spot(),F=FC,mar=F.marine&&s.exp!=='estuary';
  let h=`<tr><th></th><th>Time</th><th>Wind</th><th>Gust</th>${F.marine?'<th>Waves</th>':''}<th>Rain</th><th>Temp</th><th>UV</th><th>Tide</th><th>Bite</th></tr>`;
  for(const x of a.hrs){const i=x.i,T=x.b.T;h+=`<tr class="${x.ses?'':'off'}" data-why="${esc(x.r.why.map(w=>Y.LV[w[0]]+': '+w[1]).join('\n')||'All within your green limits')}"><td><span class="dot L${x.r.lvl}"></span></td><td>${fmtH(x.t)}</td>
   <td>${arrow(F.dir[i])} ${Y.compass(F.dir[i])} ${Math.round(F.wind[i])}${x.r.off?' <span class="small cau">off</span>':''}</td><td>${Math.round(F.gust[i])}</td>
   ${F.marine?`<td>${F.wave[i]!=null?F.wave[i].toFixed(1)+' m'+(F.wper[i]?' @'+Math.round(F.wper[i])+'s':''):'—'}${mar?'':' <span class="small mut">(n/a)</span>'}</td>`:''}
   <td>${(F.rain[i]||0).toFixed(1)}${F.pop[i]!=null?' <span class="small mut">'+F.pop[i]+'%</span>':''}</td><td>${Math.round(F.temp[i])}°</td><td>${F.uv[i]!=null?Math.round(F.uv[i]):''}</td>
   <td>${T.z.toFixed(1)} ${T.rising?'↗':'↘'}</td><td><span class="pill" style="background:${bcol(x.b.s)}">${Math.round(x.b.s)}</span></td></tr>`;}
  $('hrTable').innerHTML=h;$('hrTable').querySelectorAll('tr[data-why]').forEach(r=>r.onclick=()=>alert(r.dataset.why));}
/* ---------- Fishing tab ---------- */
function renderFish(){daySel($('fiDay'));const a=DAYS[$('fiDay').value];if(!a)return;curDay=a.date;
  const best=a.sess.slice().sort((x,y)=>y.b.s-x.b.s).slice(0,3);
  $('fiSum').innerHTML=`<h3>${fmtDL(a.d0+12*36e5)} ${light(a.lvl)}</h3>
   <p>🌙 ${phaseEmoji(a.moon.phase,-25)} ${phaseName(a.moon.phase)} (${Math.round(a.moon.fraction*100)}% lit)</p>
   <table>${a.sol.map(x=>`<tr><td>${x.major?'⭐ Major':'· Minor'}</td><td>${fmtT(x.t0)}–${fmtT(x.t1)}</td><td class="mut">${esc(x.label)}</td></tr>`).join('')}</table>
   <p class="small">🌊 ${a.ext.map(x=>(x.hi?'High ':'Low ')+fmtT(x.t)+' '+x.z.toFixed(1)+' m').join(' · ')}</p>
   <p>${a.fishWin?`🎯 <b>Best safe fishing window: ${fmtT(a.fishWin.t0)}–${fmtT(a.fishWin.t1)}</b> (bite ${Math.round(a.fishWin.avg)}, ${Y.LV[a.fishWin.lvl].toLowerCase()})`:'No safe window to fish in your session hours.'}</p>
   <p class="small mut">Top hours in your session: ${best.map(x=>fmtH(x.t)+' '+Math.round(x.b.s)+(x.b.sol.v?' ('+(x.b.sol.major?'major':'minor')+')':'')+' · '+esc(x.b.T.stage)).join(' | ')}</p>
   <p class="small mut">Bite score = solunar ${Y.BW.sol} + moving tide ${Y.BW.tide} + dawn/dusk light ${Y.BW.light} + moon phase ${Y.BW.moon} (Mac's Jacks logic).${P.ok?` Personalised from your log (${P.sessions} sessions, ${P.fish} fish).`:` Log 5+ sessions to personalise it.`}</p>`;
  $('fiHrs').innerHTML=a.hrs.map(x=>`<div class="hr" style="background:${bcol(x.b.s)};${x.r.lvl?'outline:2px solid '+(x.r.lvl>1?'#ff6b6b':'#ffc14d'):''};${x.ses?'':'opacity:.4'}"><b>${Math.round(x.b.s)}</b>${fmtH(x.t)}</div>`).join('');
  const sel=$('fiThr');if(!sel.options.length){sel.add(new Option('auto (day median, min 45)','auto'));[40,45,50,55,60,65,70].forEach(v=>sel.add(new Option('bite below '+v,v)));sel.value=LS.get('thr','auto');sel.onchange=()=>{LS.set('thr',sel.value);renderFish();};}
  const H=a.sess.filter(x=>x.r.lvl<=1);if(!H.length){$('fiPlan').innerHTML='<p class="mut">No green/amber hours in your session to plan.</p>';return;}
  const med=H.map(x=>x.b.s).sort((p,q)=>p-q)[Math.floor(H.length/2)];const thr=sel.value==='auto'?Math.max(45,Math.round(med)):+sel.value;
  const B=[];for(const x of H){const ty=x.b.s>=thr?'fish':'rest';const l=B[B.length-1];if(l&&l.ty===ty&&x.t-l.t1<=36e5){l.t1=x.t+36e5;l.pk=Math.max(l.pk,x.b.s);l.lv=Math.max(l.lv,x.r.lvl);}else B.push({ty,t0:x.t,t1:x.t+36e5,pk:x.b.s,lv:x.r.lvl});}
  $('fiPlan').innerHTML=B.map(b=>`<div class="blk ${b.ty}"><b style="min-width:120px">${fmtT(b.t0)}–${fmtT(b.t1)}</b><span>${b.ty==='fish'?'🎣 Fish':'🧃 Yak time'}${b.lv?' '+Y.EMO[b.lv]:''}</span><span class="mut small">peak ${Math.round(b.pk)}</span></div>`).join('')+`<p class="small mut">Yak time below ${thr}.</p>`;}
/* ---------- Trip tab: paddle planner + check-in ---------- */
let tmap=null,tLayer=null;const targets=()=>LS.get('targets',[]);
function initTripMap(){if(tmap){setTimeout(()=>tmap.invalidateSize(),50);drawTrip();return;}const s=spot();
  tmap=L.map('tripmap').setView([s.lat,s.lng],13);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri'}).addTo(tmap);
  tLayer=L.layerGroup().addTo(tmap);tmap.on('click',ev=>{const n=prompt('Name this target spot (stays on this phone)','Spot '+(targets().length+1));if(n==null)return;
    const dir=prompt('Which way is it from the launch?\n1 = upstream (run-in helps going there)\n2 = toward the sea/mouth (run-out helps going there)\n3 = along the coast (ignore tide)\nBlank = work it out','');
    const t=targets();t.push({id:Date.now(),name:n,lat:ev.latlng.lat,lng:ev.latlng.lng,dir:{1:'up',2:'down',3:'none'}[dir]||'auto'});LS.set('targets',t);LS.set('tgt',t[t.length-1].id);renderTrip();});drawTrip();}
function drawTrip(){if(!tLayer)return;tLayer.clearLayers();const s=spot();L.circleMarker([s.lat,s.lng],{radius:8,color:'#3ddc84'}).bindTooltip('Launch: '+s.name).addTo(tLayer);
  const sel=LS.get('tgt',null);for(const t of targets()){L.marker([t.lat,t.lng],{icon:PIN()}).bindPopup(`<b>${esc(t.name)}</b><br><button data-del="${t.id}">Delete</button>`).on('popupopen',ev=>{const b=ev.popup.getElement().querySelector('[data-del]');b&&(b.onclick=()=>{LS.set('targets',targets().filter(q=>q.id!==t.id));tmap.closePopup();renderTrip();});}).addTo(tLayer);
    if(t.id===sel)L.polyline([[s.lat,s.lng],[t.lat,t.lng]],{color:'#ffc14d',dashArray:'6 6'}).addTo(tLayer);}}
function renderTrip(){daySel($('tpDay'));const T=targets(),ts=$('tpTarget');ts.innerHTML='';ts.add(new Option(T.length?'— pick a target —':'Tap the map to add one',''));T.forEach(t=>ts.add(new Option(t.name,t.id)));ts.value=LS.get('tgt','')||'';
  ts.onchange=()=>{LS.set('tgt',+ts.value||null);renderTrip();};
  $('tpSpeed').value=SET.s.speed;$('tpFish').value=SET.s.fishHours;$('tpCur').value=SET.s.current;
  ['tpSpeed','tpFish','tpCur'].forEach(id=>$(id).onchange=()=>{SET.s[{tpSpeed:'speed',tpFish:'fishHours',tpCur:'current'}[id]]=+$(id).value;saveSet();renderTrip();});
  drawTrip();const a=DAYS[$('tpDay').value],tg=T.find(t=>t.id===+ts.value);
  if(!a||!tg){$('tpOut').innerHTML='<p class="small mut">Pick a day and a target spot to get leave and return times.</p>';renderCI();return;}curDay=a.date;
  const p=Y.planTrip(FC,a,spot(),tg,SET.s);if(!p){$('tpOut').innerHTML='<p class="no">That trip does not fit inside your session hours on this day. Try a closer spot, a shorter fishing time or longer session hours.</p>';renderCI();return;}
  const turn=Y.windTurn(FC,a,spot(),SET.s,{backMin:p.backMin,retBrg:p.retBrg});const tl=p.sign>0?'upstream':p.sign<0?'toward the mouth/sea':'along the coast (tide ignored)';
  $('tpOut').innerHTML=`<p>${light(p.lvl)} <b>${esc(tg.name)}</b>: ${p.dist.toFixed(1)} nm ${Y.compass(p.brg)} (${tl}).</p>
   <table><tr><td>🚣 Leave</td><td><b>${fmtT(p.leave)}</b></td><td class="mut">${Math.round(p.outMin)} min out</td></tr>
   <tr><td>🎣 Fish</td><td><b>${fmtT(p.arrive)}–${fmtT(p.fishTill)}</b></td><td class="mut">bite avg ${Math.round(p.bite)}</td></tr>
   <tr><td>↩ Head back</td><td><b>${fmtT(p.fishTill)}</b></td><td class="mut">${Math.round(p.backMin)} min back</td></tr>
   <tr><td>🏁 Home</td><td><b>${fmtT(p.home)}</b></td><td></td></tr></table>
   ${turn&&turn.by?`<p class="cau">💨 ${turn.change?esc(turn.change.kind)+' about '+fmtT(turn.change.t)+'. ':''}${turn.headwind?'Headwind on the way home from '+fmtT(turn.headwind)+'. ':''}${turn.firstBad?'Turns '+Y.LV[turn.firstBad.lvl].toLowerCase()+' from '+fmtT(turn.firstBad.t)+'. ':''}<b>Head back by ${fmtT(turn.by)}</b>.</p>`:''}
   <p class="small mut">Estimate: ${SET.s.speed} kn paddling, tidal current up to ${SET.s.current} kn scaled by how fast the tide is moving at ${esc(PORTS.ports[a.port].name)} (×0.3 on open coast), headwind costs ~0.07 kn per knot over 4 kn, tailwind helps ~0.03. Real currents vary with channels and bars.</p>
   <p><button id="tpCi">🆘 Use ${fmtT(p.home)} as my check-in time</button></p>`;
  $('tpCi').onclick=()=>{setLocalDT($('ciTime'),p.home);$('ciTime').scrollIntoView({behavior:'smooth'});};renderCI();}
/* check-in */
function setLocalDT(el,ms){const p=tzParts(ms,TZ);el.value=`${p.y}-${String(p.mo).padStart(2,'0')}-${String(p.d).padStart(2,'0')}T${String(p.h).padStart(2,'0')}:${String(p.mi).padStart(2,'0')}`;}
function getLocalDT(el){return el.value?parseLocalIso(el.value,TZ):null;}
const CI=()=>LS.get('ci',null);let ciTimers=[],watchId=null;
function lastFix(){return LS.get('fix',null);}
function startWatch(){if(!navigator.geolocation||watchId!=null)return;watchId=navigator.geolocation.watchPosition(p=>LS.set('fix',{lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy),t:Date.now()}),()=>{},{enableHighAccuracy:true,maximumAge:60000});}
function stopWatch(){if(watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);watchId=null;}
function notify(title,body,tag){if(!('Notification' in window)||Notification.permission!=='granted')return;const o={body,icon:'icons/icon-192.png',badge:'icons/icon-64.png',tag:tag||'yak'};
  (navigator.serviceWorker?navigator.serviceWorker.ready.then(r=>r.showNotification(title,o)):Promise.reject()).catch(()=>{try{new Notification(title,o);}catch(x){}});}
function scheduleCI(){ciTimers.splice(0).forEach(clearTimeout);const c=CI();if(!c||c.back)return;const now=Date.now();
  const at=(t,f)=>{const dt=t-now;if(dt>0&&dt<2**31)ciTimers.push(setTimeout(f,dt));};
  at(c.due,()=>{notify("Mac's Yak check-in",'You planned to be back now. Tap “I\'m back” in the app.','ci');renderCI();});
  at(c.due+c.grace*6e4,()=>{notify("Mac's Yak: overdue",'You are past your check-in. Open the app to send your position to '+(c.name||'your contact')+'.','ci2');renderCI();});
  ciTimers.push(setInterval(renderCI,60000));}
function ciMsg(){const f=lastFix(),c=CI()||{};return `Mac's Yak check-in: I'm out kayaking from ${spot().name} and haven't checked in (due back ${c.due?fmtT(c.due):'?'}).`+(f?` Last GPS ${f.lat.toFixed(5)},${f.lng.toFixed(5)} (±${f.acc} m) at ${fmtT(f.t)}: https://maps.google.com/?q=${f.lat.toFixed(5)},${f.lng.toFixed(5)}`:' No GPS fix yet.');}
function freshFix(cb){if(!navigator.geolocation)return cb();navigator.geolocation.getCurrentPosition(p=>{LS.set('fix',{lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy),t:Date.now()});cb();},()=>cb(),{enableHighAccuracy:true,timeout:8000,maximumAge:60000});}
function renderCI(){const c=CI(),b=$('ciBanner'),now=Date.now();const ct=LS.get('contact',{});if(!$('ciName').value)$('ciName').value=ct.name||'';if(!$('ciPhone').value)$('ciPhone').value=ct.phone||'';if(!$('ciGrace').value)$('ciGrace').value=SET.s.grace;
  if(!c||c.back){b.hidden=true;$('ciState').innerHTML=c&&c.back?`<span class="go">Checked in at ${fmtT(c.back)}.</span>`:'No trip running.';return;}
  const over=now>c.due,late=now>c.due+c.grace*6e4;
  $('ciState').innerHTML=`Trip running since ${fmtT(c.started)} · due back <b>${fmtT(c.due)}</b> (${fmtD(c.due)}) · grace ${c.grace} min${lastFix()?` · last GPS ${fmtT(lastFix().t)}`:''}`;
  if(over){b.hidden=false;b.className='banner';b.innerHTML=`<b>${late?'🆘 You are overdue':'⏰ Check-in time'}</b> (due ${fmtT(c.due)}). <div class="row" style="margin-top:6px"><button class="pri" data-ci="back">✅ I'm back</button>${late?`<button data-ci="share">📍 Share position</button><button data-ci="sms">💬 SMS ${esc(c.name||'contact')}</button>`:'<button data-ci="snooze">+30 min</button>'}</div>`;
    b.querySelectorAll('[data-ci]').forEach(x=>x.onclick=()=>({back:ciBack,share:ciShare,sms:ciSms,snooze:()=>{const q=CI();q.due+=30*6e4;LS.set('ci',q);scheduleCI();renderCI();}})[x.dataset.ci]());}else b.hidden=true;}
function saveContact(){LS.set('contact',{name:$('ciName').value.trim(),phone:$('ciPhone').value.trim()});}
$('ciName').onchange=$('ciPhone').onchange=saveContact;$('ciGrace').onchange=()=>{SET.s.grace=+$('ciGrace').value||30;saveSet();};
$('ciStart').onclick=()=>{const due=getLocalDT($('ciTime'));if(!due||due<Date.now())return alert('Set the time you will be back first.');saveContact();
  LS.set('ci',{started:Date.now(),due,grace:+$('ciGrace').value||30,name:$('ciName').value.trim(),phone:$('ciPhone').value.trim()});startWatch();scheduleCI();renderCI();
  if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().then(scheduleCI);alert('Trip started. Keep the app open in the background if you can. Add the 📅 calendar alarm as a backup.');};
function ciBack(){const c=CI();if(c){c.back=Date.now();LS.set('ci',c);}stopWatch();scheduleCI();renderCI();}
function ciShare(){freshFix(()=>{const t=ciMsg();if(navigator.share)navigator.share({title:"Mac's Yak position",text:t}).catch(()=>{});else{prompt('Copy this message',t);}});}
function ciSms(){const c=CI()||{},ph=(c.phone||$('ciPhone').value||'').replace(/[^\d+]/g,'');if(!ph)return alert('Save an emergency contact mobile first.');freshFix(()=>{location.href=`sms:${ph}?&body=${encodeURIComponent(ciMsg())}`;});}
$('ciBack').onclick=ciBack;$('ciShare').onclick=ciShare;$('ciSms').onclick=ciSms;
$('ciIcs').onclick=()=>{const due=getLocalDT($('ciTime'));if(!due)return alert('Set the time you will be back first.');const g=+$('ciGrace').value||30,z=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Macs Yak//EN','BEGIN:VEVENT','UID:ci'+due+'@macsyak','DTSTAMP:'+z(Date.now()),'DTSTART:'+z(due),'DTEND:'+z(due+g*6e4),'SUMMARY:Kayak check-in: am I back?','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Kayak check-in','END:VALARM','BEGIN:VALARM','TRIGGER:PT'+g+'M','ACTION:DISPLAY','DESCRIPTION:Overdue: send your position','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));a.download='kayak-check-in.ics';a.click();};
/* ---------- Log tab ---------- */
const logs=()=>LS.get('log',[]);let FORM=null;
function ctxFor(t0,t1){const s=spot(),out=[];const port=Y.portFor(s.sys||'burnett-river');
  for(let t=Math.floor(t0/9e5)*9e5;t<t1;t+=9e5){const d0=dayStart(ymd(t,TZ),TZ),ev=Y.events(d0,s.lat,s.lng),b=Y.bite(t,s,ev,port,null);let lvl=null,wind=null;
    if(FC){const i=Math.round((t-FC.t[0])/36e5);if(i>=0&&i<FC.t.length){lvl=Y.rateHour(FC,i,s,SET.s).lvl;wind=Math.round(FC.wind[i]);}}
    out.push({t,score:Math.round(b.s),stg:b.T.stage,sol:b.sol.v>0?(b.sol.major?'major':'minor'):'none',alt:Math.round(b.alt*10)/10,lvl,wind});}
  return {spot:{name:s.name,exp:s.exp},slots:out};}
function renderLog(){const act=LS.get('active',null);
  $('lgActive').innerHTML=`<h3>📓 Yak catch log <span class="mut small">${logs().length} sessions</span></h3>${act?`<p>Session running since <b>${fmtT(act.t0)}</b> · ${act.catches.length} fish</p><div class="row"><button class="pri" id="lgQuick">🐟 Quick catch</button><button id="lgEnd">■ End session</button></div>`:`<div class="row"><button class="pri" id="lgStart">▶ Start session now</button><button id="lgPast">🗓 Log a past session</button></div>`}
   <p class="small mut">Log every session, blanks too: catch rate per hour is what tests the bite times. Score, tide stage, solunar, light, wind and the traffic light are attached automatically. After 5+ sessions your log nudges the bite scores (±15%) on the Days and Fishing tabs, like Mac's Jacks.</p>`;
  if(act){$('lgQuick').onclick=()=>{const sp=prompt('Species','Flathead');if(sp==null)return;const len=prompt('Length (cm), blank if unknown','');const k=confirm('Kept? (OK = kept, Cancel = released)');act.catches.push({t:Date.now(),sp,len:len?+len:null,kept:k});LS.set('active',act);renderLog();};
    $('lgEnd').onclick=()=>openForm({t0:act.t0,t1:Date.now(),catches:act.catches,spot:spot().name,fromActive:true});}
  else{$('lgStart').onclick=()=>{LS.set('active',{t0:Date.now(),catches:[]});renderLog();};$('lgPast').onclick=()=>openForm({t0:Date.now()-3*36e5,t1:Date.now(),catches:[],spot:spot().name});}
  const L=logs();const h=L.reduce((a,s)=>a+(s.t1-s.t0)/36e5,0),n=L.reduce((a,s)=>a+s.catches.length,0);
  const byL=[0,1,2].map(l=>{let hh=0,nn=0;for(const s of L)if(s.ctx){hh+=s.ctx.slots.filter(x=>x.lvl===l).length/4;nn+=s.catches.filter(c=>{const sl=s.ctx.slots.find(x=>Math.abs(x.t-c.t)<4.5e5);return sl&&sl.lvl===l;}).length;}return hh?(nn/hh).toFixed(2)+'/h':'—';});
  $('lgStats').innerHTML=`<h3>Your numbers</h3><div class="kv"><div><b>${L.length}</b><small>sessions</small></div><div><b>${h.toFixed(1)} h</b><small>on the water</small></div><div><b>${n}</b><small>fish</small></div><div><b>${h?(n/h).toFixed(2):'—'}</b><small>fish / hour</small></div>
   <div><b>${byL[0]}</b><small>🟢 hours</small></div><div><b>${byL[1]}</b><small>🟠 hours</small></div></div>
   <p class="small mut">${P.ok?`Personal bite model on: major solunar ×${P.m.sol.major.toFixed(2)}, run-in ×${P.m.stg.in.toFixed(2)}, run-out ×${P.m.stg.out.toFixed(2)}, dawn/dusk ×${P.m.light.lowlight.toFixed(2)}.`:`Personal bite model starts after 5 sessions, 6 hours and 3 fish (${P.sessions}/5 sessions).`}</p>`;
  $('lgList').innerHTML=L.slice().reverse().map(s=>`<li><b>${fmtD(s.t0)} ${fmtT(s.t0)}–${fmtT(s.t1)}</b> · ${esc(s.spot)} · ${s.catches.length?s.catches.length+' fish':'blank'}<div class="small mut">${s.catches.map(c=>esc(c.sp)+(c.len?' '+c.len+' cm':'')+(c.kept?' (kept)':'')).join(', ')}${s.bait?' · '+esc(s.bait):''}${s.note?' · '+esc(s.note):''}</div><button data-del="${s.id}" class="small">✕</button></li>`).join('');
  $('lgList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('Delete this session?'))return;LS.set('log',logs().filter(s=>s.id!==+b.dataset.del));P=Y.personal(logs());renderLog();});}
function openForm(f){FORM=f;$('lgForm').hidden=false;setLocalDT($('lgS0'),f.t0);setLocalDT($('lgS1'),f.t1);$('lgSpot').value=f.spot||'';$('lgBait').value=LS.get('lastBait','');$('lgNote').value='';setLocalDT($('lgCt'),f.t1);drawCatches();$('lgForm').scrollIntoView({behavior:'smooth'});}
function drawCatches(){$('lgCatches').innerHTML=FORM.catches.length?FORM.catches.map((c,i)=>`<div class="blk fish">${fmtT(c.t)} ${esc(c.sp)}${c.len?' '+c.len+' cm':''} ${c.kept?'(kept)':'(released)'} <button data-rm="${i}">✕</button></div>`).join(''):'<p class="small mut">No fish (blank session) — that still counts.</p>';
  $('lgCatches').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{FORM.catches.splice(+b.dataset.rm,1);drawCatches();});}
$('lgAddC').onclick=()=>{if(!FORM)return;const t=getLocalDT($('lgCt'));FORM.catches.push({t:t||Date.now(),sp:$('lgSp').value||'Fish',len:+$('lgLen').value||null,kept:$('lgKR').value==='Kept'});$('lgSp').value='';$('lgLen').value='';drawCatches();};
$('lgCancel').onclick=()=>{$('lgForm').hidden=true;FORM=null;};
$('lgSave').onclick=()=>{const t0=getLocalDT($('lgS0')),t1=getLocalDT($('lgS1'));if(!t0||!t1||t1<=t0)return alert('Check the start and end times.');
  const s={id:Date.now(),t0,t1,spot:$('lgSpot').value.trim(),bait:$('lgBait').value.trim(),note:$('lgNote').value.trim(),catches:FORM.catches,ctx:ctxFor(t0,t1)};LS.set('lastBait',s.bait);
  const L=logs();L.push(s);LS.set('log',L);if(FORM.fromActive)LS.set('active',null);$('lgForm').hidden=true;FORM=null;P=Y.personal(L);analyse();renderDays();renderLog();};
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();}
$('lgCsv').onclick=()=>{const r=[['session_start','session_end','spot','bait','note','catch_time','species','length_cm','kept','score_at_catch','tide_stage','solunar','light_alt','wind_kn','traffic_light']];
  for(const s of logs()){const base=[new Date(s.t0).toISOString(),new Date(s.t1).toISOString(),s.spot,s.bait,s.note];if(!s.catches.length)r.push(base.concat(['','','','','','','','','','']));
    for(const c of s.catches){const sl=s.ctx&&s.ctx.slots.reduce((a,x)=>Math.abs(x.t-c.t)<Math.abs(a.t-c.t)?x:a,s.ctx.slots[0])||{};r.push(base.concat([new Date(c.t).toISOString(),c.sp,c.len||'',c.kept?'kept':'released',sl.score,sl.stg,sl.sol,sl.alt,sl.wind,sl.lvl!=null?Y.LV[sl.lvl]:'']));}}
  dl('macs-yak-log.csv',r.map(x=>x.map(v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',')).join('\n'),'text/csv');};
$('lgJson').onclick=()=>dl('macs-yak-backup.json',JSON.stringify({v:1,log:logs(),targets:targets(),set:SET,contact:LS.get('contact',{})}),'application/json');
$('lgImp').onchange=ev=>{const f=ev.target.files[0];if(!f)return;f.text().then(t=>{const j=JSON.parse(t);if(j.log){const ids=new Set(logs().map(s=>s.id));LS.set('log',logs().concat(j.log.filter(s=>!ids.has(s.id))));}if(j.targets&&!targets().length)LS.set('targets',j.targets);P=Y.personal(logs());renderLog();alert('Imported.');}).catch(x=>alert('Import failed: '+x.message));};
/* ---------- Setup tab ---------- */
let smap=null,sMark=null;
function initSpotMap(){if(smap){setTimeout(()=>smap.invalidateSize(),50);return;}const s=spot();smap=L.map('spotmap').setView([s.lat,s.lng],11);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagery © Esri'}).addTo(smap);
  Y.LAUNCHES.forEach(l=>L.circleMarker([l.lat,l.lng],{radius:5,color:'#ff9a3c'}).bindTooltip(l.name).on('click',()=>{SET.launchId=l.id;afterSpot();}).addTo(smap));
  sMark=L.marker([s.lat,s.lng],{icon:PIN()}).addTo(smap);smap.on('click',ev=>{const ns=Y.nearestSys(ev.latlng.lat,ev.latlng.lng);const c=SET.custom||{};
    SET.custom={id:'custom',name:'My launch',lat:ev.latlng.lat,lng:ev.latlng.lng,exp:c.exp||(ns&&ns.km<3?'estuary':'open'),facing:c.facing!=null?c.facing:90,sys:ns&&ns.id};SET.launchId='custom';afterSpot();});}
function afterSpot(){saveSet();const s=spot();if(sMark)sMark.setLatLng([s.lat,s.lng]);if(tmap)tmap.setView([s.lat,s.lng],13);fillSet();refresh(true);}
function fillSet(){$('setDays').innerHTML=[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" value="${d}" ${SET.days.includes(d)?'checked':''}>${DOWN[d]}</label>`).join('');
  $('setDays').querySelectorAll('input').forEach(x=>x.onchange=()=>{SET.days=[...$('setDays').querySelectorAll('input:checked')].map(i=>+i.value);saveSet();renderDays();});
  const sl=$('setLaunch');sl.innerHTML='';Y.LAUNCHES.forEach(l=>sl.add(new Option(l.name,l.id)));if(SET.custom)sl.add(new Option('My launch (map pin)','custom'));sl.value=SET.launchId;sl.onchange=()=>{SET.launchId=sl.value;afterSpot();};
  const s=spot(),ex=$('setExp');ex.innerHTML='';for(const k in Y.EXPOSURE)ex.add(new Option(Y.EXPOSURE[k],k));ex.value=s.exp;
  const fc=$('setFacing');fc.innerHTML='';fc.add(new Option('n/a (sheltered)',''));for(let d=0;d<360;d+=22.5)fc.add(new Option(Y.compass(d)+' ('+d+'°)',d));fc.value=s.facing==null?'':String(s.facing);
  const edit=(k,v)=>{if(SET.launchId!=='custom'){SET.custom=Object.assign({},spot(),{id:'custom',name:spot().name+' (edited)'});SET.launchId='custom';}SET.custom[k]=v;afterSpot();};
  ex.onchange=()=>edit('exp',ex.value);fc.onchange=()=>edit('facing',fc.value===''?null:+fc.value);
  [['setS0','sessionStart'],['setS1','sessionEnd'],['setMin','minWindow']].forEach(([id,k])=>{$(id).value=SET.s[k];$(id).onchange=()=>{SET.s[k]=+$(id).value;saveSet();analyse();renderAll();};});
  const TH=[['windGreen','Green below wind (kn)'],['windRed','Red above wind (kn)'],['gustGreen','Green below gusts (kn)'],['gustRed','Red above gusts (kn)'],['waveGreen','Green below waves (m)'],['waveRed','Red above waves (m)'],['offshoreFactor','Offshore wind: multiply limits by'],['rainAmber','Amber at rain (mm/h)'],['popAmber','Amber at rain chance (%)'],['visAmber','Amber below visibility (km)']];
  $('setThr').innerHTML=TH.map(([k,l])=>`<label>${l} <input type="number" step="0.1" data-k="${k}" value="${SET.s[k]}"></label>`).join('');
  $('setThr').querySelectorAll('input').forEach(x=>x.onchange=()=>{SET.s[x.dataset.k]=+x.value;saveSet();analyse();renderAll();});
  $('setNotifState').textContent=!('Notification' in window)?'Notifications are not supported in this browser. On iPhone, add the app to your Home Screen first (iOS 16.4+).':'Notifications: '+Notification.permission+(LS.get('notifyOn',false)?' · alerts on':'');}
$('setReset').onclick=()=>{if(!confirm('Reset thresholds and session hours to the defaults?'))return;SET.s=Object.assign({},Y.DEFAULTS);saveSet();fillSet();analyse();renderAll();};
$('setNotif').onclick=async()=>{if(!('Notification' in window))return alert('Notifications are not supported here. On iPhone, add Mac\'s Yak to your Home Screen and open it from there.');
  const p=await Notification.requestPermission();LS.set('notifyOn',p==='granted');pushSW();
  if(p==='granted'&&navigator.serviceWorker){try{const r=await navigator.serviceWorker.ready;if(r.periodicSync)await r.periodicSync.register('yak-check',{minInterval:6*36e5});}catch(x){}}fillSet();checkAlerts(true);};
$('setTest').onclick=()=>{const d=nextChosen();const a=d&&DAYS[d];notify("Mac's Yak test",a?alertText(a):'Alerts work. No kayak day in the forecast yet.','test');if(!('Notification' in window)||Notification.permission!=='granted')alert('Enable alerts first.');};
/* ---------- alerts on open ---------- */
function alertText(a){return `${Y.EMO[a.lvl]} ${Y.LV[a.lvl]} ${fmtD(a.d0+12*36e5)} at ${spot().name}. Wind ${Math.round(a.wind[0])}–${Math.round(a.wind[1])} kn, gusts ${Math.round(a.gust)}${a.wave!=null&&spot().exp!=='estuary'?', waves '+a.wave.toFixed(1)+' m':''}.`+(a.win?` Best ${fmtT(a.win.t0)}–${fmtT(a.win.t1+36e5)}.`:'')+(a.fishWin?` Bite best ${fmtT(a.fishWin.t0)}.`:'')+(a.turn&&a.turn.by?` Head back by ${fmtT(a.turn.by)}.`:'');}
function checkAlerts(force){if(!LS.get('notifyOn',false)||!('Notification' in window)||Notification.permission!=='granted')return;const h=tzParts(Date.now(),TZ).h,t=today(),tm=addDays(t,1),sent=LS.get('sent',{});
  const go=(d,slot)=>{const a=DAYS[d];if(!a||!SET.days.includes(dowOf(d)))return;const k=d+'|'+slot;if(sent[k]&&!force)return;sent[k]=Date.now();LS.set('sent',sent);notify((slot==='am'?'Today: ':'Tomorrow: ')+"Mac's Yak",alertText(a),'yak-'+d);};
  if(h<11)go(t,'am');if(h>=14)go(tm,'eve');}
/* ---------- static text ---------- */
function staticText(){const D=Y.DEFAULTS;
  $('howBody').innerHTML=`<p class="small">Each hour gets a light from the worst of: wind, gusts, waves (open coast and river mouths only), thunderstorms, rain and visibility. A day is <b>green</b> if your session hours have a run of at least ${SET.s.minWindow} green hours in daylight, <b>amber</b> if only a green-or-amber run, otherwise <b>red</b>.</p>
  <table><tr><th></th><th>🟢 Green</th><th>🟠 Amber</th><th>🔴 Red</th></tr><tr><td>Wind (avg)</td><td>&lt; ${SET.s.windGreen} kn</td><td>${SET.s.windGreen}–${SET.s.windRed} kn</td><td>&gt; ${SET.s.windRed} kn or ≥ 26 kn</td></tr>
  <tr><td>Gusts</td><td>&lt; ${SET.s.gustGreen} kn</td><td>${SET.s.gustGreen}–${SET.s.gustRed} kn</td><td>&gt; ${SET.s.gustRed} kn</td></tr><tr><td>Waves</td><td>&lt; ${SET.s.waveGreen} m</td><td>${SET.s.waveGreen}–${SET.s.waveRed} m</td><td>&gt; ${SET.s.waveRed} m</td></tr>
  <tr><td>Offshore wind</td><td colspan="3">wind and gust limits × ${SET.s.offshoreFactor} (it blows you away from the beach)</td></tr><tr><td>Storms</td><td colspan="3">🔴 thunderstorm forecast; 🟠 unstable air with showers</td></tr><tr><td>Rain / fog</td><td colspan="3">🟠 ≥ ${SET.s.rainAmber} mm/h, showers ≥ ${SET.s.popAmber}% likely, visibility &lt; ${SET.s.visAmber} km</td></tr></table>
  <p class="small mut">Change any of these in ⚙️ Setup. See Setup → Safety for the sources.</p>`;
  $('safety').innerHTML=`<h3>📖 Safety and where the limits come from</h3><ul class="small">
  <li><b>Wind:</b> the Bureau of Meteorology says novice paddlers should keep to winds under <b>10 knots</b> and advanced paddlers to no more than 20 knots (<a href="https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/coasts-and-oceans/marine-weather-safety/water-sports-safety" target="_blank" rel="noopener">BOM water sports safety</a>). For small vessels, BOM says winds over <b>15 knots</b> are generally unsuitable (<a href="https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/coasts-and-oceans/marine-weather-safety/boating-safety" target="_blank" rel="noopener">BOM boating safety</a>).</li>
  <li><b>Gusts:</b> BOM notes gusts can be <b>40% stronger</b> than the average wind, so the gust limits sit about 5 kn above the wind limits.</li>
  <li><b>Warnings:</b> BOM marine wind warnings only start at <b>26 knots</b> (strong wind 26–33 kn, gale 34–47 kn), well above kayak limits, so no warning does not mean safe (<a href="https://reg.bom.gov.au/marine/about/six-things-about-wind-warnings.shtml" target="_blank" rel="noopener">BOM wind warnings</a>). Any hour at strong-wind level, or with a thunderstorm forecast, is red. Always check <a href="https://www.bom.gov.au/qld/warnings/" target="_blank" rel="noopener">BOM QLD warnings</a> and the <a href="https://www.bom.gov.au/qld/forecasts/marine.shtml" target="_blank" rel="noopener">coastal waters forecast</a> before you go. The app cannot read BOM warnings directly.</li>
  <li><b>Waves:</b> BOM suggests novices keep to waves under <b>0.5 m</b>. Paddle Australia's Sea Guide award covers novice groups in breaking seas and surf up to <b>1.0 m</b>, below a strong wind warning; the Sit-on-Top Coastal Guide covers winds below 17 knots within 1 nautical mile of shore (<a href="https://education.paddle.org.au/schemeAssessmentGuidelines/ag-225-Current.html" target="_blank" rel="noopener">Paddle Australia</a>, <a href="https://www.mittacanoe.com.au/wp-content/uploads/Safety_Guidelines1.pdf" target="_blank" rel="noopener">Australian Canoeing safety guidelines</a>). The wave figure here comes from the nearest offshore model cell, so beach waves are usually smaller. Drop the green limit to 0.5 m if you want the BOM novice figure.</li>
  <li><b>Offshore wind:</b> it looks calm at the beach but pushes you out to sea, and the waves build further out, so the limits are cut to ${Math.round(SET.s.offshoreFactor*100)}%.</li>
  <li><b>Bars and river mouths:</b> Maritime Safety Queensland says don't cross a bar in heavy swell, strong wind or on a run-out tide, and sea and surf kayaks must wear a lifejacket on designated coastal bars (<a href="https://www.msq.qld.gov.au/safety/crossing-a-bar" target="_blank" rel="noopener">MSQ bar crossings</a>).</li>
  <li><b>Stingers:</b> Queensland's marine stinger season runs November to May (<a href="https://www.qld.gov.au/emergency/safety/recreation/dangerous-marine" target="_blank" rel="noopener">qld.gov.au</a>, <a href="https://lifesaving.com.au/safety-info/marine-stingers" target="_blank" rel="noopener">SLSQ</a>).</li>
  <li>Wear your PFD, carry a phone in a waterproof pouch, a whistle and a light, and tell someone your plan (use 🆘 check-in on the Trip tab). MSQ weather line: 13 00 36 04 26.</li></ul>
  <p class="small mut">This is a planning guide, not a guarantee. The forecast can be wrong. If it looks worse than the app says, stay on the beach.</p>`;
  $('srcList').innerHTML=`<p class="small">Weather: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> forecast API (best-match models incl. BOM ACCESS) and Marine API (waves, swell, sea temperature), CC-BY 4.0, fetched by your phone. Tides: Mac's Jacks base-port harmonics (MSQ predictions, CC-BY 4.0) for ${esc(PORTS.ports[Y.portFor(spot().sys||'burnett-river')].name)}; upstream tides run later. Sun, moon and solunar periods: Mac's Jacks code. Fresh/flood state: <a href="${JACKS}" target="_blank" rel="noopener">Mac's Jacks</a> gauges (BOM/DES water levels), updated hourly. Imagery © Esri.</p><p class="small mut">Build ${esc(window.BUILD)} · forecast ${FC?fmtT(FC.at)+' '+fmtD(FC.at):'not loaded'}${FC&&FC.marineCell?` · wave cell ${FC.marineCell[0].toFixed(2)}, ${FC.marineCell[1].toFixed(2)}`:''}</p>`;}
/* ---------- boot ---------- */
function renderAll(){staticText();renderDays();const t=document.querySelector('.tab.on');if(t){const id=t.id.slice(2);if(id==='hours')renderHours();if(id==='fish')renderFish();if(id==='trip')renderTrip();if(id==='log')renderLog();}}
async function refresh(force){$('dataAge').textContent='loading…';$('notice').innerHTML='';let src;
  try{[src]=await Promise.all([loadFC(force),loadFlood()]);}catch(x){$('notice').innerHTML=`<div class="card warn">Couldn't load the forecast (${esc(x.message)}). Check your signal and tap ↻.</div>`;$('dataAge').textContent='offline';}
  analyse();renderAll();if(FC)$('dataAge').textContent=(src==='stale'?'⚠ offline, forecast from ':'updated ')+fmtT(FC.at)+(src==='stale'?' '+fmtD(FC.at):'');
  if(src==='stale')$('notice').innerHTML=`<div class="card warn">You're offline. Showing the forecast saved at ${fmtT(FC.at)} ${fmtD(FC.at)}.</div>`;
  if(FC&&!FC.marine)$('notice').innerHTML+=`<div class="card warn">Wave forecast unavailable right now; lights use wind, storms and rain only.</div>`;checkAlerts();}
$('refresh').onclick=()=>refresh(true);
fillSet();pushSW();refresh(false);scheduleCI();renderCI();if(CI()&&!CI().back)startWatch();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){renderCI();if(FC&&Date.now()-FC.at>45*6e4)refresh(false);else checkAlerts();}});
if(location.hash==='#trip'||location.hash==='#checkin')showTab('trip');else if(location.hash==='#log')showTab('log');
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
