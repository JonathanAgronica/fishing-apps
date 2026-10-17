/* ===== Plan my day: suggested fish / move / rest schedule for one date on the current river system =====
   Scores = the Bite tab's exact 15-min scoring per spot (spot types, Baffle single-high stands, forecast weather or
   outlook, flood cycle) computed — with the schedule optimisation — in the calendar's Web Worker (main-thread fallback).
   Settings live in localStorage (per system). Spot names stay on the phone: .ics uses '★ my spot (km x)'. */
(function(){'use strict';
const FT=window.FT,B=window.BT,MJ=window.MJ,C=window.FTCalc;if(!FT||!B||!MJ||!C||!document.getElementById('planSheet'))return;
const A=()=>FT.calApi;const $=id=>document.getElementById(id),TZ=C.TZ,GEN=!!B.generic,S=FT.spots,SYS=FT.SYS||'baffle';
const KEY=FT.k('ft_plan');const ld=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return{};}};
let set=Object.assign({start:240,end:1440,speed:25,thr:'auto',minBlock:30,maxH:0,dd:false,launch:'auto',sel:null},ld());
if(![15,30,45,60,90].includes(set.minBlock))set.minBlock=30;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(set));}catch(e){}};
let cur={ds:null,plan:null,cfg:null,cfgAt:0,worker:null,seq:0};
const esc=s=>A().esc(s),fmtT=ms=>A().fmtT(ms),scoreColor=s=>A().scoreColor(s);
const T=s=>String(s).replace(/@T([\d.]+)/g,(m,x)=>fmtT(Math.round(+x)));
const keyOf=p=>p.id||('km:'+p.line+':'+p.km);
const EJ=GEN?0:window.BAFFLE_DATA.euleilahJunctionKm;
function withGeo(p){const main=A().isMainLine(p.line);let j=0;if(!main)j=GEN?((B.LINES.find(L=>L.id===p.line)||{}).j||0):(B.isSide&&B.isSide(p.line)&&B.parentOf(p.line)==='B'?B.sideOf(p.line).jk:EJ);return Object.assign({},p,{main,j});}
const isRamp=l=>!!(l.ramp||/ramp/i.test(l.name||''));
/* candidate spots: your own spots + built-in landmarks (+ km points on small systems) */
function cands(){const cs=(S?S.customs():[]).map(A().lmPt),lm=(S?S.builtins():B.LANDMARKS).map(A().lmPt);let extra=[];
  if(lm.filter(p=>A().isMainLine(p.line)).length<6)extra=A().scanPts().filter(p=>!p.lm&&!p.custom&&A().isMainLine(p.line));
  return cs.concat(lm,extra).map(withGeo);}
function defaultSel(all){const cs=all.filter(p=>p.custom);if(cs.length)return cs.map(keyOf);
  const pool=all.filter(p=>!p.custom);if(pool.length<=12)return pool.map(keyOf);
  const sorted=pool.slice().sort((a,b)=>(a.main?0:1)-(b.main?0:1)||a.km-b.km).filter(p=>p.main);const out=[];for(let i=0;i<12;i++)out.push(sorted[Math.round(i*(sorted.length-1)/11)]);return [...new Set(out.map(keyOf))];}
function selSpots(all){const ks=set.sel&&set.sel.length?set.sel:defaultSel(all);const L=all.filter(p=>ks.includes(keyOf(p)));return L.length?L:all.filter(p=>defaultSel(all).includes(keyOf(p)));}
function launchOf(all,sp){if(set.launch&&set.launch!=='auto'){const l=all.find(p=>keyOf(p)===set.launch);if(l)return l;}
  const med=sp.map(p=>p.km).sort((a,b)=>a-b)[Math.floor(sp.length/2)]||0;const rs=all.filter(p=>!p.custom&&isRamp(p)&&p.main);
  if(rs.length)return rs.sort((a,b)=>Math.abs(a.km-med)-Math.abs(b.km-med))[0];return sp.slice().sort((a,b)=>a.km-b.km)[0];}
const hhmm=m=>{const h=Math.floor(m/60)%24,mm=m%60;return (h%12||12)+(mm?':'+String(mm).padStart(2,'0'):'')+(h<12?'am':'pm')+(m>=1440?' (next day)':'');};
function optsHTML(all){const sel=new Set(selSpots(all).map(keyOf)),lch=launchOf(all,selSpots(all));
  const st=[];for(let m=0;m<=720;m+=30)st.push(m);const en=[];for(let m=900;m<=1620;m+=30)en.push(m);
  return `<div class="pnote">Spots to use (${S&&S.customs().length?'your spots are on by default':'built-in landmarks'}):</div><div class="posp">${all.map(p=>`<label><input type="checkbox" data-k="${esc(keyOf(p))}"${sel.has(keyOf(p))?' checked':''}>${p.custom?'★ ':''}${esc(p.name)} <span class="mut">${p.km.toFixed(1)}</span></label>`).join('')}</div>
  <div class="pogrid">
   <label>Start<select id="poStart">${st.map(m=>`<option value="${m}"${m===set.start?' selected':''}>${hhmm(m)}</option>`).join('')}</select></label>
   <label>End<select id="poEnd">${en.map(m=>`<option value="${m}"${m===set.end?' selected':''}>${m===1440?'midnight':hhmm(m)}</option>`).join('')}</select></label>
   <label>Launch from<select id="poLaunch"><option value="auto"${set.launch==='auto'?' selected':''}>auto (${esc(lch?lch.name:'')})</option>${all.map(p=>`<option value="${esc(keyOf(p))}"${set.launch===keyOf(p)?' selected':''}>${isRamp(p)?'⛵ ':''}${p.custom?'★ ':''}${esc(p.name)}</option>`).join('')}</select></label>
   <label>Boat speed (km/h)<input type="number" id="poSpeed" min="3" max="60" step="1" value="${set.speed}"></label>
   <label>Rest threshold<select id="poThr"><option value="auto"${set.thr==='auto'?' selected':''}>auto: max(55, day median)</option>${[45,50,55,60,65,70,75,80].map(v=>`<option value="${v}"${String(set.thr)===String(v)?' selected':''}>rest below ${v}</option>`).join('')}</select></label>
   <label>Min block<select id="poMin">${[15,30,45,60,90].map(v=>`<option value="${v}"${v===set.minBlock?' selected':''}>${v} min</option>`).join('')}</select></label>
   <label>Max fishing hours<select id="poMax"><option value="0">no limit</option>${[2,3,4,5,6,8,10].map(v=>`<option value="${v}"${v===set.maxH?' selected':''}>${v} h</option>`).join('')}</select></label>
   <label style="justify-content:flex-end"><span><input type="checkbox" id="poDD"${set.dd?' checked':''}> Dawn &amp; dusk focus</span></label>
  </div><div class="pnote">Travel time = along-creek distance ÷ boat speed + 3 min, rounded up to the 15-min plan grid. Settings are remembered on this phone.</div>`;}
function bindOpts(all){const re=()=>{save();run();};
  $('planOptsB').querySelectorAll('[data-k]').forEach(c=>c.onchange=()=>{set.sel=[...$('planOptsB').querySelectorAll('[data-k]')].filter(x=>x.checked).map(x=>x.dataset.k);re();});
  $('poStart').onchange=e=>{set.start=+e.target.value;re();};$('poEnd').onchange=e=>{set.end=+e.target.value;re();};
  $('poLaunch').onchange=e=>{set.launch=e.target.value;re();};$('poSpeed').onchange=e=>{set.speed=Math.max(3,Math.min(60,+e.target.value||25));re();};
  $('poThr').onchange=e=>{set.thr=e.target.value==='auto'?'auto':+e.target.value;re();};$('poMin').onchange=e=>{set.minBlock=+e.target.value;re();};
  $('poMax').onchange=e=>{set.maxH=+e.target.value;re();};$('poDD').onchange=e=>{set.dd=e.target.checked;re();};}
async function getCfg(){const c=A().cfg;if(c)return c;if(cur.cfg&&Date.now()-cur.cfgAt<30*60e3)return cur.cfg;cur.cfg=await A().buildCfg('sys');cur.cfgAt=Date.now();return cur.cfg;}
function compute(cfg,req){return new Promise(res=>{const id=++cur.seq;let w=cur.worker;
  const main=()=>{try{const t=performance.now();const P=C.planDay(C.makeCore(B,MJ,cfg),req);P.ms=Math.round(performance.now()-t);P.mode='main thread';res(P);}catch(e){res({error:String(e.message||e)});}};
  if(!w&&!FT.calNoWorker&&!/[?&]calmain=1\b/.test(location.search)&&window.Worker){try{w=cur.worker=new Worker(A().workerURL());}catch(e){w=null;}}
  if(!w)return main();
  const to=setTimeout(()=>{w.onmessage=null;main();},60000);
  w.onmessage=e=>{const m=e.data||{};if(m.type!=='plan'||m.id!==id)return;clearTimeout(to);if(m.error){console.warn('plan worker',m.error);return main();}m.plan.mode='Web Worker';res(m.plan);};
  w.onerror=e=>{clearTimeout(to);console.warn('plan worker error',e.message);cur.worker=null;main();};
  w.postMessage({type:'plan',id,cfg:{opts:cfg.opts,wx:cfg.wx,sst:cfg.sst,fresh:cfg.fresh,sys:cfg.sys},req});});}
async function run(){const ds=cur.ds,all=cands(),sp=selSpots(all),lch=launchOf(all,sp);
  $('planOptsB').innerHTML=optsHTML(all);bindOpts(all);document.body.dataset.planReady='';
  if(!sp.length){$('planB').innerHTML='<p class="mut">Pick at least one spot in Options.</p>';return;}
  $('planB').innerHTML=`<p class="mut"><span class="spin"></span> Scoring ${sp.length} spot${sp.length>1?'s':''} at 15-min steps and planning…</p>`;
  const cfg=await getCfg();if(ds!==cur.ds)return;
  const req={date:ds,spots:sp,launch:lch,startMin:set.start,endMin:Math.max(set.end,set.start+120),speed:set.speed,thr:set.thr,minBlock:set.minBlock,maxFishH:set.maxH,dd:set.dd};
  if(FT.cross&&lch){const li=sp.findIndex(p=>Math.abs(p.km-lch.km)<0.05&&p.line===lch.line);const locs=sp.concat(li>=0?[]:[lch]);const d0=A().dayStart?A().dayStart(ds):Date.parse(ds+'T00:00:00+10:00');try{const xb=FT.cross.planBlocks(locs,d0+set.start*6e4-36e5,d0+Math.max(set.end,set.start+120)*6e4+36e5);if(xb)req.xb=xb;}catch(e){console.error('crossings',e);}}
  const P=await compute(cfg,req);if(ds!==cur.ds)return;cur.plan=P;cur.cfg2=cfg;
  if(P.error){$('planB').innerHTML='<p class="notice err">Couldn’t plan: '+esc(P.error)+'</p>';return;}
  if(FT.cross)try{P.xnotes=FT.cross.planNotes(P);}catch(e){console.error('crossings',e);}
  render(P,cfg);document.body.dataset.planReady=ds;}
const nm=(P,i)=>{const p=P.spots[i];return p?`${p.custom?'★ ':''}${esc(p.name)}`:'';};
const nmKm=(P,i)=>{const p=P.spots[i];return p?`${nm(P,i)} <small class="mut">km ${p.km.toFixed(1)}</small>`:'';};
const span=(a,b)=>`${fmtT(a).replace(/(am|pm)$/,m=>fmtT(b).slice(-2)===m?'':m)}–${fmtT(b)}`;
function render(P,cfg){const fc=cfg&&cfg.wx&&cfg.wx.tt.length&&cfg.wx.tt[cfg.wx.tt.length-1]>=P.t0+6*36e5;
  const B0=P.blocks,fish=B0.filter(b=>b.ty==='fish');
  const R5=(cls,c4,why,narrow=true)=>`<tr class="${cls}${narrow?'':' pone1'}">${c4}<td class="pwc">${why}</td></tr>${narrow?`<tr class="pwr ${cls}"><td colspan="4">${why}</td></tr>`:''}`;
  const rows=B0.map((b,k)=>{if(b.ty==='fish')return R5('fish'+(b.optional?' opt':''),`<td class="pt">${span(b.t0,b.t1)}</td><td class="pp">🎣 Fish${b.optional?'<br><span class="popt">optional</span>':''}</td><td>${nmKm(P,b.loc)}</td><td class="ps" style="color:${scoreColor(b.peak)}">${b.peak}<small>avg ${b.avg}</small></td>`,`<ul>${b.why.map(w=>'<li>'+esc(T(w))+'</li>').join('')}</ul>${(()=>{const p=P.spots[b.loc];return p&&FT.lureHtml?FT.lureHtml({depth:p.depth,km:p.km,line:p.line||null,lat:p.lat,lng:p.lng},(b.t0+b.t1)/2):'';})()}`);
    if(b.ty==='move')return R5('move',`<td class="pt">${fmtT(b.t0)}</td><td class="pp">🚤 Move</td><td>→ ${nmKm(P,b.loc)}<small class="mut pmv"> · ${b.km} km, ~${b.min} min</small></td><td class="ps">—</td>`,`<span class="mut">${b.km} km · ~${b.min} min</span>`,false);
    const first=k===0,last=k===B0.length-1,sl=P.best.slice(Math.round((b.t0-P.t0)/9e5),Math.round((b.t1-P.t0)/9e5)),mx=Math.max(...sl),av=sl.length?Math.round(sl.reduce((a,v)=>a+v,0)/sl.length):NaN,here=nm(P,b.loc);
    const what=first&&b.next?`Launch from ${here}${b.leaveT?' by '+fmtT(b.leaveT):''}`:last||!b.next?`Done — back to ${nm(P,P.launch)}`:`At ${here} — be back at ${nm(P,b.next.loc)} by ${fmtT(b.next.t)}`;
    return R5('rest',`<td class="pt">${span(b.t0,b.t1)}</td><td class="pp">${first&&b.next?'⏸ Free':last||!b.next?'⏸ Free':'💤 Rest'}</td><td>${what}</td><td class="ps">${isFinite(mx)?mx:'—'}</td>`,`<span class="mut">best available averages ${isFinite(av)?av:'—'}${isFinite(mx)?', peaks '+mx:''} (rest threshold ${P.thr})</span>`);}).join('');
  const one=P.one,oneH=one?`<div class="pone">🎯 <b>If you only fish one session:</b> ${span(one.t0,one.t1)} — ${[...new Set(one.blocks.filter(b=>b.ty==='fish').map(b=>b.loc))].map(i=>nm(P,i)).join(' → ')} (peak ${Math.max(...one.blocks.filter(b=>b.ty==='fish').map(b=>b.peak))})${P.solo&&(!one||P.solo.loc!==one.blocks[0].loc||Math.abs(P.solo.t0-one.t0)>36e5)?`<br><span class="mut">Single spot, no moves: ${nm(P,P.solo.loc)} ${span(P.solo.t0,P.solo.t1)} (avg ${P.solo.avg})</span>`:''}</div>`:'<div class="pone">No fishing block clears the threshold on this day — try a lower rest threshold.</div>';
  const opt=(o,lab)=>o?`<li>${lab}: <b>${span(o.t0,o.t1)}</b> at ${nm(P,o.loc)} — avg ${o.avg}, peak ${o.peak}${o.ri?` (${o.ri.kind==='rise'?'water starts rising':'run-in starts'} ${fmtT(o.ri.t)} ±${Math.round(o.ri.u)}′)`:''}</li>`:'';
  const extra=opt(P.early,'🌙 Early option (before your start)')+opt(P.late,'🌙 Late-night option (after your end)');
  const bench=P.bench.map(x=>x.kind==='single'?`<li>🌗 ${nm(P,x.loc)}: <b>single-high day</b> — water should stand ${fmtT(x.sd.t0)}–${fmtT(x.sd.t1)} with no second rise. Seen a rise? Log it (Tides → Benchmarks, “both highs”).</li>`
    :x.kind==='both'?`<li>🌊 ${nm(P,x.loc)}: both highs expected today — if only one comes, log “single high” (Tides → Benchmarks).</li>`
    :`<li>⏱ ${nm(P,x.loc)} ~${fmtT(x.t)} ±${Math.round(x.u)}′: ${x.kind==='rise'?'water starts rising':'low turn'} — note the real time (Tides → Benchmarks).</li>`).join('');
  const thrTxt=P.auto?`auto = max(55, median ${P.med})`:'set';
  $('planB').innerHTML=`<p class="csub">${A().moonOf(P.date).e} ${esc(A().fmtDay(P.date,{weekday:'long',day:'numeric',month:'long'}))} · ${esc(FT.SYSNAME)} · ${fc?'<span class="tagf">FORECAST</span> weather':'<span class="tago">OUTLOOK</span> neutral weather, seasonal water temp'} · ${hhmm(set.start)}–${set.end===1440?'midnight':hhmm(set.end)}</p>
  <div class="psum"><span>🎣 ${P.fishH.toFixed(1)} h fishing</span><span>🚤 ${fish.length?B0.filter(b=>b.ty==='move').length:0} moves · ${P.moveKm} km</span><span>💤 rest below ${P.thr} (${thrTxt})</span><span>⛵ launch ${nm(P,P.launch)}</span></div>
  ${oneH}
  <div style="overflow-x:auto"><table class="ptl"><tr><th>Time</th><th>Plan</th><th>Spot</th><th>Score</th><th class="pwc">Why</th></tr>${rows}</table></div>
  ${extra?`<ul class="pnote" style="padding-left:18px;margin:6px 0">${extra}</ul>`:''}
  ${chart(P)}
  ${bench?`<h3 class="csec">✅ Benchmark checks along the route</h3><ul class="pnote" style="padding-left:18px;margin:0">${bench}</ul>`:''}
  <p class="pnote">Timing uncertainty grows upstream (± shown per block); ${GEN?'':'on Baffle single-high days the small high stalls above ~22 km (tide stand) and that run-in is skipped. '}Same scoring as 🎣 Bite times for each spot (spot types, ${fc?'forecast weather':'neutral weather'}, flood cycle). Planned in ${P.ms} ms (${esc(P.mode||'')}).</p>
  <div class="pbtn"><button class="sm" id="planIcs">📆 Add to phone calendar (.ics)</button><button class="sm" id="planShare">📤 Share as text</button>${fish.length?'<button class="sm pri" id="planStart">📝 Start session (Catch log)</button>':''}</div><div id="planShareBox"></div>`;
  $('planIcs').onclick=()=>{const ev=fish.map(b=>{const p=P.spots[b.loc];const where=p.custom?`★ my spot (km ${p.km.toFixed(1)})`:`${p.name} (km ${p.km.toFixed(1)})`;
      return{start:b.t0,end:b.t1,title:`🎣 Fish ${where} — peak ${b.peak}${b.optional?' (optional)':''}`,desc:`Mac's Jacks plan for ${FT.SYSSHORT}: avg ${b.avg}, peak ${b.peak}. ${b.why.map(T).join('; ').replace(/★[^;]*/g,'')}`};});
    if(ev.length)A().dl(`macs-jacks-plan-${SYS}-${P.date}.ics`,A().ics(ev));};
  $('planShare').onclick=async()=>{const txt=shareText(P);try{if(navigator.share){await navigator.share({title:'Mac’s Jacks plan '+P.date,text:txt});return;}}catch(e){if(e&&e.name==='AbortError')return;}
    $('planShareBox').innerHTML=`<p class="pnote">⚠ This text includes your own spot names — only share it with people you trust. Copied to the clipboard if allowed:</p><textarea class="pshare" readonly>${esc(txt)}</textarea>`;try{await navigator.clipboard.writeText(txt);}catch(e){}FT.planLastShare=txt;};
  if($('planStart'))$('planStart').onclick=()=>{const b=fish[0],p=P.spots[b.loc];const l=p.id&&S?S.get(p.id):null;close();FT.catchLogAt(l||{name:p.name,km:p.km,line:p.line,lat:p.lat,lng:p.lng});};}
function shareText(P){const L=[`Mac's Jacks — plan for ${A().fmtDay(P.date,{weekday:'long',day:'numeric',month:'long'})}, ${FT.SYSNAME}`,`(Contains my own spot names — please keep them to yourself.)`,''];
  for(const b of P.blocks){const n=P.spots[b.loc]?P.spots[b.loc].name:'';
    if(b.ty==='fish')L.push(`${span(b.t0,b.t1)}  FISH ${n} (km ${P.spots[b.loc].km.toFixed(1)}) — peak ${b.peak}${b.optional?' (optional)':''}: ${b.why.map(T).join('; ')}`);
    else if(b.ty==='move')L.push(`${fmtT(b.t0)}  MOVE → ${n} (${b.km} km, ~${b.min} min)`);
    else if(b.next)L.push(`${span(b.t0,b.t1)}  REST — be back at ${P.spots[b.next.loc].name} by ${fmtT(b.next.t)}`);}
  if(P.one)L.push('',`One session only: ${span(P.one.t0,P.one.t1)}`);L.push(`Total fishing ${P.fishH.toFixed(1)} h; rest below ${P.thr}.`);return L.join('\n');}
function chart(P){const W=360,H=120,pl=24,pr=6,pt=8,pb=18,n=P.best.length;if(n<2)return '';const x=k=>pl+(W-pl-pr)*k/(n-1),y=v=>pt+(H-pt-pb)*(1-Math.max(0,Math.min(100,v))/100);
  let o=`<svg class="pchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Chosen spot score vs best possible">`;
  for(const v of [25,50,75,100])o+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="#1d3a3f"/><text x="2" y="${y(v)+3}" fill="#6f8b87" font-size="8">${v}</text>`;
  for(const b of P.blocks)if(b.ty==='fish'){const k0=(b.t0-P.t0)/9e5,k1=(b.t1-P.t0)/9e5;o+=`<rect x="${x(k0)}" y="${pt}" width="${Math.max(1,x(Math.min(n-1,k1))-x(k0))}" height="${H-pt-pb}" fill="#57d18a" opacity=".12"/>`;}
  o+=`<line x1="${pl}" x2="${W-pr}" y1="${y(P.thr)}" y2="${y(P.thr)}" stroke="#ff7b6b" stroke-dasharray="3 3"/>`;
  o+=`<polyline fill="none" stroke="#9db5b1" stroke-width="1.2" stroke-dasharray="4 2" points="${P.best.map((v,k)=>x(k)+','+y(v)).join(' ')}"/>`;
  let seg=[];const flush=()=>{if(seg.length>1)o+=`<polyline fill="none" stroke="#7ff0c8" stroke-width="2.4" points="${seg.join(' ')}"/>`;seg=[];};
  P.chosen.forEach((v,k)=>{if(v==null)flush();else seg.push(x(k)+','+y(v));});flush();
  for(let k=0;k<n;k+=12){const t=P.t0+k*9e5;o+=`<text x="${x(k)}" y="${H-5}" fill="#6f8b87" font-size="8" text-anchor="middle">${fmtT(t).replace(':00','')}</text>`;}
  return o+`</svg><div class="pnote"><span style="color:#7ff0c8">━</span> score where the plan has you fishing · <span style="color:#9db5b1">┅</span> best possible of your chosen spots · <span style="color:#ff7b6b">┅</span> rest threshold</div>`;}
function close(){$('planSheet').hidden=true;document.body.style.overflow='';delete document.body.dataset.planOpen;}
FT.planDay=function(ds){if(!ds)ds=MJ.ymd(Date.now(),TZ);cur.ds=ds;$('planSheet').hidden=false;document.body.style.overflow='hidden';document.body.dataset.planOpen=ds;
  $('planT').textContent='🗓 Plan my day — '+A().fmtDay(ds,{weekday:'short',day:'numeric',month:'short'});
  if(!localStorage.getItem(KEY))$('planOpts').open=true;run();};
FT.plan={get cur(){return cur},get set(){return set},run,close,shareText};
$('planX').onclick=close;$('planSheet').querySelector('.calsheet-bg').onclick=close;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('planSheet').hidden)close();});
const pb=document.getElementById('mj-planBtn');if(pb)pb.onclick=()=>{const d=document.getElementById('mj-date');FT.planDay(d&&d.value);};
if(S)S.onChange.push(()=>{if(!$('planSheet').hidden)run();});
})();
