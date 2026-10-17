/* ===================== Gauges tab ===================== */
(function(){
'use strict';
const $=id=>document.getElementById(id);const FT=window.FT;
const E0=Date.UTC(2025,11,31,14);           // minute 0 = 2026-01-01 00:00 AEST
const toMs=m=>E0+m*60000, nowM=()=>(Date.now()-E0)/60000;
const fT=(m,o)=>new Intl.DateTimeFormat('en-AU',Object.assign({timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit',hour12:true},o||{})).format(new Date(toMs(m))).replace(' am','am').replace(' pm','pm');
const fDT=m=>fT(m,{weekday:'short',day:'numeric',month:'short'});
const hm=min=>{if(min==null||isNaN(min))return '—';const s=min<0?'−':'';min=Math.abs(min);return s+Math.floor(min/60)+':'+String(Math.round(min%60)).padStart(2,'0');};
const ago=m=>{const d=Math.max(0,nowM()-m);return d<1?'just now':d<90?Math.round(d)+' min ago':d<48*60?(d/60).toFixed(1)+' h ago':(d/1440).toFixed(1)+' days ago';};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let D=null,lastFetch=0,fetchedFrom='',view=null,shown=false;
const KM={win:3.4,hills:25.24,ess:35.25};
const SER=[ // id, label, colour, kind, default on
 {id:'bundaberg',lab:'Bundaberg obs',col:'#3b8fd9',k:'line',on:true},
 {id:'bundaberg_pred',lab:'Bundaberg MSQ pred',col:'#8fb8de',k:'line',dash:'3 3',on:false},
 {id:'win',lab:'Winfield pred (MSQ offsets)',col:'#17becf',k:'model',dash:'7 4',on:true},
 {id:'hillsrd',lab:'Hills Rd 539135',col:'#2ca02c',k:'step',on:true},
 {id:'hills_m',lab:'Hills Rd model',col:'#98df8a',k:'model',dash:'2 3',on:false},
 {id:'essendean',lab:'Essendean 039267',col:'#e5484d',k:'step',on:true,dots:true},
 {id:'ess_m',lab:'Essendean model',col:'#ff9896',k:'model',dash:'2 3',on:false},
 {id:'lags',lab:'Lag panel',col:'#c9a227',k:'panel',on:true},
 {id:'mimdale',lab:'Mimdale 539132',col:'#b48cff',k:'panel',on:true}];
const on=JSON.parse(localStorage.getItem('ft_gauge_on')||'null')||{};SER.forEach(s=>{if(on[s.id]===undefined)on[s.id]=s.on;});
const LAGS=[{k:'essendean',kind:'HW',lab:'Essendean HW',col:'#e5484d'},{k:'essendean',kind:'LW',lab:'Essendean low-plateau',col:'#ff9896'},{k:'hillsrd',kind:'HW',lab:'Hills Rd HW',col:'#2ca02c'},{k:'hillsrd',kind:'LW',lab:'Hills Rd LW',col:'#98df8a'}];

function legend(){$('gLegend').innerHTML=SER.map(s=>`<button data-s="${s.id}" class="${on[s.id]?'':'off'}"><i style="background:${s.col}"></i>${esc(s.lab)}</button>`).join('');
  $('gLegend').querySelectorAll('button').forEach(b=>b.onclick=()=>{on[b.dataset.s]=!on[b.dataset.s];localStorage.setItem('ft_gauge_on',JSON.stringify(on));legend();draw();});}

async function load(force){
  if(!force&&D&&Date.now()-lastFetch<4*60e3)return;
  try{const r=await fetch('data/gauges.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
    D=await r.json();fetchedFrom=r.headers.get('x-ft-cache')?'cache':'network';}
  catch(e){if(!D){$('gLatest').innerHTML='<div class="notice err">Couldn\'t load gauge data ('+esc(e.message)+'). Connect once to cache it for offline use.</div>';return;}}
  lastFetch=Date.now();
  if(!view)setRange(7,true);
  render();}
function lastVal(arr,m){let lo=0,hi=arr.length-1,r=null;while(lo<=hi){const mid=(lo+hi)>>1;if(arr[mid][0]<=m){r=arr[mid];lo=mid+1;}else hi=mid-1;}return r;}
function render(){if(!D)return;latest();stats();events();draw();upd();document.body.dataset.gaugesReady='1';}
function upd(){if(!D)return;const g=D.generated;const gm=(Date.parse(g)-E0)/60000;
  $('gUpd').innerHTML=`Data file updated <b>${ago(gm)}</b> (${fT(gm,{weekday:'short',day:'numeric',month:'short'})})${fetchedFrom==='cache'?' · <b>offline copy</b>':''} · app re-checks every 10 min`;
  document.querySelectorAll('[data-ago]').forEach(el=>el.textContent=ago(+el.dataset.ago));}
function latest(){const S=D.series;const card=(k,lab,unit,extra)=>{const a=S[k];if(!a||!a.length)return '';const L=a[a.length-1];const p=lastVal(a,L[0]-60);const d=p?L[1]-p[1]:0;
    const ar=Math.abs(d)<0.005?'→':d>0?'↑':'↓';
    return `<div class="gst"><small>${lab}</small><b>${L[1].toFixed(2)} ${unit} ${ar}</b><small>${fT(L[0],{weekday:'short'})} · <span data-ago="${L[0]}">${ago(L[0])}</span>${extra?'<br>'+extra:''}</small></div>`;};
  const B=S.bundaberg;const bL=B&&B.length?B[B.length-1]:null;
  const nxt=km=>{if(!window.BT)return '';const nh=nowM()/60;const P=pred(km,nh-12,nh+48);const h=P.ext.find(e=>e.hi&&!e.weak&&e.t>nh),sd=P.ext.find(e=>e.stand&&e.standT1>nh&&(!h||e.t<h.t));
    return (sd?`🌗 stand ${fT(sd.standT0*60,{weekday:'short'})}–${fT(sd.standT1*60)} (no rise)<br>`:'')+(h?`model next HW ${fT(h.t*60,{weekday:'short'})} (${h.h.toFixed(2)})`:'');};
  $('gLatest').innerHTML=card('essendean','Essendean Bridge (35.3 km)','m AHD',nxt(KM.ess))+card('hillsrd','Hills Rd, Euleilah Ck','m AHD',nxt(KM.hills))+card('bundaberg','Bundaberg (Burnett Hds)','m AHD',bL?`= ${(bL[1]+1.693).toFixed(2)} m LAT`:'')+card('mimdale','Mimdale (fresh-flow)','m')+(FT.gSpots?FT.gSpots.cards():'');
  // fresh-flow indicator
  const M=S.mimdale||[];let html='';
  if(M.length){const L=M[M.length-1];const d24=lastVal(M,L[0]-1440),w=M.filter(x=>x[0]>=L[0]-7*1440);const mn=Math.min(...w.map(x=>x[1]));
    const rise24=d24?L[1]-d24[1]:0,above=L[1]-mn;
    const lvl=above>0.5||rise24>0.3?'bad':above>0.1||rise24>0.08?'warn':'ok';
    html=`<div class="notice ${lvl==='ok'?'info':lvl==='bad'?'err':''}">💧 <b>Fresh-flow &amp; tide-model reliability (Mimdale, upstream of the tide):</b> ${L[1].toFixed(2)} m, ${rise24>=0?'+':''}${rise24.toFixed(2)} m in 24 h, ${above.toFixed(2)} m above its 7-day low. `+
      (lvl==='ok'?'Steady base flow — tide-driven readings at Essendean/Hills Rd are representative.':lvl==='warn'?'Rising — some fresh coming down: upper-creek lows will sit higher and peaks look smaller; consider the Baffle tab\'s “Upper-creek base adj”.':'<b>Fresh / flood flow</b> — upper-creek levels are flow-dominated; tide lags & the model are unreliable above ~25 km.')+'</div>';}
  $('gFresh').innerHTML=html;
  if(FT.floodInfo){const el=$('gFresh');FT.floodInfo().then(h=>{if(h&&el.isConnected){const o=el.querySelector('.gflood');if(o)o.remove();el.insertAdjacentHTML('beforeend','<div class="gflood">'+h+'</div>');}}).catch(()=>{});}}
function statAdj(k){const s=D.stats[k];if(!s||!/_HW$/.test(k))return s;const gk=k.replace('_HW','');const C=hwCheck(gk,gk==='essendean'?KM.ess:KM.hills);if(!C)return s;
  const bad=new Set(C.filter(c=>c.stand&&c.obs).map(c=>c.obs));if(!bad.size)return s;
  const ev=D.events[gk].filter(e=>e.k==='HW'&&!bad.has(e));const L=ev.map(e=>e.lag),last=D.series[gk][D.series[gk].length-1][0],W=ev.filter(e=>e.t>=last-7*1440).map(e=>e.lag);
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,sd=a=>a.length>1?Math.sqrt(a.reduce((x,y)=>x+(y-mean(a))**2,0)/(a.length-1)):null;
  return Object.assign({},s,{all:Object.assign({},s.all,{n:L.length,mean:L.length?mean(L):null,sd:sd(L)}),last7d:{n:W.length,mean:W.length?mean(W):null},excl:bad.size});}
function stats(){const S={};for(const k in D.stats)S[k]=statAdj(k);const row=(lab,k)=>{const s=S[k];if(!s)return '';const a=s.all,w=s.last7d;const drift=a.n?a.mean-s.model:null;
    const cls=drift==null?'':Math.abs(drift)<15?'drift-ok':Math.abs(drift)<40?'drift-warn':'drift-bad';
    return `<tr><td>${lab}</td><td>${a.n||0}</td><td>${a.n?'+'+hm(a.mean):'—'}${a.sd!=null?' <span class="mut">±'+Math.round(a.sd)+'′</span>':''}</td><td>${w&&w.n?'+'+hm(w.mean)+' <span class="mut">(n '+w.n+')</span>':'—'}</td><td>+${hm(s.model)}</td><td class="${cls}">${drift==null?'—':(drift>=0?'+':'−')+Math.abs(Math.round(drift))+'′'}</td><td class="mut">±${a.u_med!=null?Math.round(a.u_med):'—'}′</td></tr>`;};
  $('gStats').innerHTML='<tr><th>Lag after Bundaberg</th><th>n tides</th><th>Mean (all) ± sd</th><th>Last 7 d</th><th>App model</th><th>Drift</th><th>Gauge step ±</th></tr>'+
    row('Essendean HW','essendean_HW')+row('Essendean low plateau (mid)','essendean_LW')+row('Hills Rd HW','hillsrd_HW')+row('Hills Rd LW','hillsrd_LW');
  const chk=(lab,gk,km)=>{const C=hwCheck(gk,km);if(!C||!C.length)return '';const ph=C.filter(c=>!c.stand),st=C.filter(c=>c.stand);const okH=ph.filter(c=>c.ok).length,okS=st.filter(c=>c.ok).length;const all=okH+okS===C.length;
    return `<tr><td>${lab}<br><span class="mut">single-high check</span></td><td>${C.length}</td><td colspan="4">${okH}/${ph.length} predicted highs seen${st.length?` · ${okS}/${st.length} predicted stands with no peak (matched)`:' · no stands predicted'}${all?'':` · <b>${C.length-okH-okS} mismatch</b>`}</td><td class="${all?'drift-ok':'drift-warn'}">${all?'✓':'✗'}</td></tr>`;};
  $('gStats').innerHTML+=chk('Essendean HW','essendean',KM.ess)+chk('Hills Rd HW','hillsrd',KM.hills);
  const ev=D.events;const first=Math.min(...['essendean','hillsrd'].flatMap(k=>ev[k].map(e=>e.bt)));
  $('gStatsNote').innerHTML=`Since ${isFinite(first)?fDT(first):'—'}. Drift = running mean − lag the app's tide model uses (green &lt;15′, amber &lt;40′, red ≥40′). A steady drift means the model needs re-calibrating; a jump during a fresh (see Mimdale) is expected. Single-high check: on neap days the small high doesn’t reach Essendean (model shows a <b>tide stand</b>); a stand counts as matched when the gauge shows no peak, and an observed peak at a predicted stand is left out of the lag/drift stats${['essendean_HW','hillsrd_HW'].some(k=>S[k]&&S[k].excl)?' (excluded: '+['essendean_HW','hillsrd_HW'].map(k=>S[k]&&S[k].excl||0).reduce((a,b)=>a+b,0)+')':''}.`;}
function events(){const rows=[];for(const L of LAGS)for(const e of D.events[L.k])if(e.k===L.kind)rows.push({...e,lab:L.lab});
  for(const [gk,km,lab] of [['essendean',KM.ess,'Essendean'],['hillsrd',KM.hills,'Hills Rd']])for(const c of hwCheck(gk,km)||[])if(c.stand){const v=lastVal(D.series[gk],c.t);rows.push({stand:true,t:c.t,s:c.s0,e:c.s1,v:v?v[1]:null,bt:c.bt,bh:c.bh,ok:c.ok,lab:lab+' tide stand'});}
  rows.sort((a,b)=>b.t-a.t);
  $('gEvents').innerHTML='<tr><th>Gauge event</th><th>Time (plateau)</th><th>Level</th><th>Bundaberg</th><th>Lag</th></tr>'+rows.filter(e=>rows.length&&e.t>=rows[0].t-10*1440).slice(0,90).map(e=>e.stand?`<tr class="mut"><td>🌗 ${e.lab}<br><span class="mut">small high suppressed</span></td><td>${fDT(e.t)}<br><span class="mut">stand ${fT(e.s)}–${fT(e.e)}</span></td><td>${e.v!=null?e.v.toFixed(2):'—'}</td><td class="mut">${fT(e.bt,{weekday:'short'})}<br>${(e.bh-1.693).toFixed(2)} AHD</td><td>${e.ok?'no peak ✓':'<b>gauge peaked ✗</b>'}</td></tr>`:`<tr><td>${e.lab}</td><td>${fDT(e.t)}<br><span class="mut">${fT(e.s)}–${fT(e.e)}</span></td><td>${e.v.toFixed(2)}</td><td class="mut">${fT(e.bt,{weekday:'short'})}<br>${(e.bh-1.693).toFixed(2)} AHD</td><td>+${hm(e.lag)} <span class="mut">±${Math.round(e.u)}′</span></td></tr>`).join('');}

/* ---------- chart ---------- */
function dataSpan(){const S=D.series;let a=Infinity,b=-Infinity;for(const k of ['bundaberg','essendean','hillsrd'])if(S[k]&&S[k].length){a=Math.min(a,S[k][0][0]);b=Math.max(b,S[k][S[k].length-1][0]);}return[a,b];}
function setRange(r,silent){const [a,b]=dataSpan();let end=Math.max(b,Math.min(nowM(),b+720))+180;if(FT.gSpots&&FT.gSpots.futureEnd())end=Math.max(end,nowM()+36*60);
  view=r==='all'?[a-120,end]:[end-r*1440,end];
  document.querySelectorAll('.gbar [data-r]').forEach(x=>x.classList.toggle('on',String(x.dataset.r)===String(r)));if(!silent)draw();}
function clampView(){let [a,b]=dataSpan();const fe=FT.gSpots&&FT.gSpots.futureEnd();if(fe)b=Math.max(b,fe-1440);if(on.ess_m||on.hills_m||on.win)b=Math.max(b,nowM()+9*1440); /* model curves can be scrolled ~10 days ahead */let w=view[1]-view[0];w=Math.max(180,Math.min(w,(b-a)+3*1440));
  let v0=view[0];v0=Math.max(a-1440,Math.min(v0,b+1440-w));view=[v0,v0+w];}
const modelCache={};
/* Baffle model at a gauge, incl. single-high suppression (Hills Rd is on Euleilah Ck → never suppressed) */
const LINE={[KM.win]:'B',[KM.hills]:'E',[KM.ess]:'B'};const pcache={};
function pred(km,h0,h1){const k=km+':'+Math.floor(h0)+':'+Math.ceil(h1);if(pcache[k])return pcache[k];if(Object.keys(pcache).length>12)for(const x in pcache)delete pcache[x];
  return pcache[k]=BT.predictAt(km,Math.floor(h0),Math.ceil(h1),{line:LINE[km]||'B'});}
/* predicted highs at a gauge over the archive, matched with the gauge's observed HW events (by Bundaberg high) */
function hwCheck(gk,km){const S=D.series[gk];if(!window.BT||!S||!S.length)return null;const s0=S[0][0],s1=S[S.length-1][0];
  const P=pred(km,s0/60-14,s1/60+14);const obs=D.events[gk].filter(e=>e.k==='HW');const out=[];
  for(const e of P.ext){if(!e.hi||!e.src)continue;const bt=e.src.t*60,t=e.t*60;if(t<s0+60||t>s1-60)continue;
    const o=obs.find(x=>Math.abs(x.bt-bt)<90);out.push({bt,bh:e.src.h,t,stand:!!e.stand,s0:e.stand?e.standT0*60:null,s1:e.stand?e.standT1*60:null,obs:o||null,ok:e.stand?!o:!!o});}
  return out;}
function model(km,v0,v1){if(!window.BT)return[];const h0=Math.floor(v0/60/6)*6-12,h1=Math.ceil(v1/60/6)*6+12,key=km+':'+h0+':'+h1;
  if(modelCache[key])return modelCache[key];
  const span=h1-h0;if(span>24*120)return[];
  const P=pred(km,h0,h1);const st=Math.max(1/6,span/1200),out=[];
  for(let h=h0;h<=h1;h+=st){const v=P.curve(h);if(v!=null)out.push([h*60,v]);}
  for(const k in modelCache)delete modelCache[k];return modelCache[key]=out;}
function thin(a,v0,v1,maxN){let i0=0;while(i0<a.length&&a[i0][0]<v0)i0++;i0=Math.max(0,i0-1);let i1=i0;while(i1<a.length&&a[i1][0]<=v1)i1++;i1=Math.min(a.length,i1+1);
  const s=a.slice(i0,i1);if(s.length<=maxN)return s;const bw=(v1-v0)/(maxN/2),out=[];let cur=null;
  for(const p of s){const b=Math.floor((p[0]-v0)/bw);if(!cur||cur.b!==b){if(cur){const x=cur.mn[0]<cur.mx[0]?[cur.mn,cur.mx]:[cur.mx,cur.mn];out.push(...x);}cur={b,mn:p,mx:p};}else{if(p[1]<cur.mn[1])cur.mn=p;if(p[1]>cur.mx[1])cur.mx=p;}}
  if(cur)out.push(cur.mn[0]<cur.mx[0]?cur.mn:cur.mx,cur.mn[0]<cur.mx[0]?cur.mx:cur.mn);return out;}
let G=null;
function draw(){if(!D||!view)return;const svg=$('gChart');const W=Math.max(300,Math.round(svg.parentNode.clientWidth||360));if(!svg.parentNode.clientWidth)return;
  clampView();const [v0,v1]=view;
  const showLag=on.lags,showMim=on.mimdale;const fs=11;const SPL=FT.gSpots?FT.gSpots.prepare(v0,v1):[];const spLeg=SPL.length?FT.gSpots.lagLegend(SPL):[];
  const L=36,R=8,pw=W-L-R;const H1=Math.round(Math.min(330,Math.max(220,W*0.62)));
  let y=8;const P1={y0:y,h:H1};y+=H1+22;
  const P2=showLag?{y0:y,h:120}:null;if(P2)y+=120+22+26+(spLeg.length?Math.ceil(spLeg.length/(pw>560?4:2))*13+4:0);
  const P3=showMim?{y0:y,h:56}:null;if(P3)y+=56+22;
  const Ht=y+18;svg.setAttribute('viewBox',`0 0 ${W} ${Ht}`);svg.style.height=Ht+'px';
  const X=m=>L+(m-v0)/(v1-v0)*pw;const S=D.series;const maxN=Math.round(pw*1.5);
  // y range panel 1
  const vis={};for(const s of SER){if(!on[s.id])continue;
    if(s.k==='line'||s.k==='step')vis[s.id]=thin(S[s.id]||[],v0,v1,maxN);
    else if(s.k==='model')vis[s.id]=thin(model(s.id==='win'?KM.win:s.id==='hills_m'?KM.hills:KM.ess,v0,v1),v0,v1,maxN);}
  let lo=Infinity,hi=-Infinity;for(const k in vis)for(const p of vis[k])if(p[0]>=v0&&p[0]<=v1){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  for(const r of SPL)for(const p of r.pts)if(p[0]>=v0&&p[0]<=v1){lo=Math.min(lo,p[1]);hi=Math.max(hi,p[1]);}
  if(!isFinite(lo)){lo=-1.5;hi=1.5;}const pad=(hi-lo)*0.06+(SPL.length?0.12:0.05);lo-=pad;hi+=pad;
  const Y1=v=>P1.y0+P1.h-(v-lo)/(hi-lo)*P1.h;
  let o='';
  // night shading + day grid
  const dayStart=Math.floor(v0/1440)*1440;
  for(let d=dayStart;d<v1;d+=1440){const n0=X(Math.max(v0,d+18.5*60)),n1=X(Math.min(v1,d+1440+5.3*60));
    if(n1>n0)o+=`<rect x="${n0}" y="${P1.y0}" width="${n1-n0}" height="${y-P1.y0-22}" fill="#000" opacity=".18"/>`;}
  const span=v1-v0;const tstep=span<=1.5*1440?180:span<=4*1440?720:span<=10*1440?1440:span<=40*1440?7*1440:30*1440;
  for(let t=Math.ceil(v0/tstep)*tstep;t<=v1;t+=tstep){const x=X(t);o+=`<line x1="${x}" x2="${x}" y1="${P1.y0}" y2="${y-22}" stroke="#25464b" stroke-width="1"/>`;
    const lab=tstep<1440?fT(t):fT(t,{hour:undefined,minute:undefined,hour12:undefined,weekday:'short',day:'numeric',month:tstep>=7*1440?'short':undefined});
    o+=`<text x="${x+3}" y="${Ht-5}" font-size="${fs}" fill="#9db5b1">${esc(lab)}</text>`;}
  const nx=X(nowM());if(nx>L&&nx<W-R)o+=`<line x1="${nx}" x2="${nx}" y1="${P1.y0}" y2="${y-22}" stroke="#f0a03a" stroke-dasharray="4 3" stroke-width="1.2"/><text x="${nx-3}" y="${P1.y0+11}" text-anchor="end" font-size="${fs}" fill="#f0a03a">now</text>`;
  // y grid panel1
  const yst=hi-lo>3?1:hi-lo>1.2?0.5:0.2;for(let v=Math.ceil(lo/yst)*yst;v<=hi;v+=yst){const yy=Y1(v);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#25464b" stroke-dasharray="2 4"/><text x="${L-4}" y="${yy+4}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${v.toFixed(1)}</text>`;}
  o+=`<text x="${L+4}" y="${P1.y0+12}" font-size="${fs}" fill="#9db5b1">m AHD</text>`;
  o+=`<clipPath id="gc1"><rect x="${L}" y="${P1.y0}" width="${pw}" height="${P1.h}"/></clipPath><g clip-path="url(#gc1)">`;
  for(const s of SER){const a=vis[s.id];if(!a||!a.length)continue;let d='';
    if(s.k==='step'){a.forEach((p,i)=>{const xx=X(p[0]).toFixed(1),yy=Y1(p[1]).toFixed(1);d+=i?`H${xx}V${yy}`:`M${xx},${yy}`;});const last=a[a.length-1];d+=`H${Math.min(X(last[0]+30),W-R).toFixed(1)}`;}
    else{let pen=false,prev=null;for(const p of a){const brk=prev&&p[0]-prev[0]>(s.k==='model'?120:45);d+=(!pen||brk?'M':'L')+X(p[0]).toFixed(1)+','+Y1(p[1]).toFixed(1);pen=true;prev=p;}}
    o+=`<path d="${d}" fill="none" stroke="${s.col}" stroke-width="${s.k==='step'?2:1.5}" ${s.dash?`stroke-dasharray="${s.dash}"`:''}/>`;
    if(s.dots&&a.length<400)o+=a.map(p=>`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y1(p[1]).toFixed(1)}" r="2" fill="${s.col}"/>`).join('');}
  // HW markers for Essendean events
  if(on.essendean)for(const e of D.events.essendean)if(e.k==='HW'&&e.t>v0&&e.t<v1){const xx=X(e.t),yy=Y1(e.v);o+=`<path d="M${xx},${yy-6}l-4,-8h8z" fill="#e5484d"/>`;}
  // model predicted highs (hollow ▽ on the model curve) and tide stands (bar; on the gauge trace when the model curve is hidden)
  if(window.BT&&(v1-v0)<=24*60*40){for(const [sid,gid,km,col] of [['ess_m','essendean',KM.ess,'#ff9896'],['hills_m','hillsrd',KM.hills,'#98df8a'],['win',null,KM.win,'#17becf']]){
      if(!on[sid]&&!(gid&&on[gid]))continue;const P=pred(km,v0/60-12,v1/60+12);
      for(const e of P.ext){const t=e.t*60;if(t<v0-600||t>v1+600)continue;
        if(e.stand){const yv=on[sid]?P.curve(e.t):(gid?(lastVal(S[gid]||[],t)||[])[1]:null);if(yv==null)continue;const x0=X(e.standT0*60),x1=X(e.standT1*60),yy=Y1(yv);
          o+=`<rect x="${x0.toFixed(1)}" y="${(yy-3).toFixed(1)}" width="${Math.max(2,x1-x0).toFixed(1)}" height="6" rx="3" fill="${col}" opacity=".45"><title>Model: tide stand (single-high day — the small high doesn’t reach here)</title></rect><text x="${((x0+x1)/2).toFixed(1)}" y="${(yy-7).toFixed(1)}" text-anchor="middle" font-size="10" fill="${col}">stand</text>`;}
        else if(e.hi&&on[sid]){const xx=X(t),yy=Y1(e.h);o+=`<path d="M${xx.toFixed(1)},${(yy-5).toFixed(1)}l-4,-7h8z" fill="#0f2427" stroke="${col}" stroke-width="1.3"/>`;}}}}
  if(SPL.length)o+=FT.gSpots.svgMain(SPL,X,Y1,v0,v1);
  if(FT.cross)o+=FT.cross.gaugeSvg({X,Y1,v0,v1,P1,redraw:draw,gauges:[...((on.essendean||on.ess_m)?[{km:KM.ess,line:'B',name:'Essendean',short:'Essendean'}]:[]),...((on.hillsrd||on.hills_m)?[{km:KM.hills,line:'E',name:'Hills Rd',short:'Hills Rd'}]:[])]});
  o+='</g>';
  // panel 2: lags
  let Y2=null;
  if(P2){const pts=[];for(const Lg of LAGS)for(const e of D.events[Lg.k])if(e.k===Lg.kind&&e.bt>=v0-600&&e.bt<=v1)pts.push({...e,col:Lg.col});
    const spp=SPL.length?FT.gSpots.lagPts(SPL,v0,v1):[];
    let a=Infinity,b=-Infinity;for(const p of pts.concat(spp)){a=Math.min(a,p.lag-p.u);b=Math.max(b,p.lag+p.u);}a=Math.min(a,60);b=Math.max(b,480);a=Math.max(0,Math.floor(a/60)*60);b=Math.ceil(b/60)*60;
    Y2=v=>P2.y0+P2.h-(v-a)/(b-a)*P2.h;
    o+=`<rect x="${L}" y="${P2.y0}" width="${pw}" height="${P2.h}" fill="none" stroke="#25464b"/>`;
    const st2=(b-a)>480?120:60;for(let v=a;v<=b;v+=st2){const yy=Y2(v);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="#25464b" stroke-dasharray="2 4"/><text x="${L-4}" y="${yy+4}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${v/60}h</text>`;}
    for(const [v,c,t] of [[65,'#17becf','Winfield HW'],[116,'#17becf','Winfield LW']]){const yy=Y2(v);o+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${c}" stroke-dasharray="${t.endsWith('HW')?'6 3':'2 3'}" opacity=".8"/>`;}
    o+=`<text x="${L+4}" y="${P2.y0+12}" font-size="${fs}" fill="#9db5b1">lag after Bundaberg (Winfield +1:05 / +1:56 dashed; small rings = model HW, × = model tide stand)${spp.length?'; hollow = spots':''}</text>`;
    o+=`<clipPath id="gc2"><rect x="${L}" y="${P2.y0}" width="${pw}" height="${P2.h}"/></clipPath><g clip-path="url(#gc2)">`;
    for(const p of pts){const xx=X(p.bt).toFixed(1);o+=`<line x1="${xx}" x2="${xx}" y1="${Y2(p.lag-p.u)}" y2="${Y2(p.lag+p.u)}" stroke="${p.col}" stroke-width="1.2" opacity=".7"/><circle cx="${xx}" cy="${Y2(p.lag)}" r="3.2" fill="${p.col}"/>`;}
    if(spp.length)o+=FT.gSpots.lagSvg(spp,X,Y2);
    if(window.BT&&(v1-v0)<=24*60*40)for(const [gid,km,col] of [['essendean',KM.ess,'#e5484d'],['hillsrd',KM.hills,'#2ca02c']]){if(!on[gid])continue;const P=pred(km,v0/60-12,v1/60+12);const cal=P.cal;
      for(const e of P.ext){if(!e.hi||!e.src)continue;const bt=e.src.t*60;if(bt<v0-600||bt>v1)continue;const xx=X(bt).toFixed(1),yy=Y2(cal.hwLag);
        if(e.stand){const seen=D.events[gid].some(x=>x.k==='HW'&&Math.abs(x.bt-bt)<90);o+=`<path d="M${+xx-3.5},${yy-3.5}l7,7m0,-7l-7,7" stroke="${col}" stroke-width="1.6" opacity=".9"/><text x="${xx}" y="${(yy+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="${col}">stand${seen?' ✗':''}</text>`;}
        else o+=`<circle cx="${xx}" cy="${yy}" r="2.6" fill="none" stroke="${col}" stroke-width="1" opacity=".6"/>`;}}
    o+='</g>';
    const cw=pw/(pw>560?4:2);if(spLeg.length){const per=pw>560?4:2,r0=pw>560?1:2;o+=spLeg.map((Lg,i)=>{const cx=L+8+(i%per)*cw,cy=P2.y0+P2.h+12+(r0+Math.floor(i/per))*13;const mk=Lg.hollow==='c'?`<circle cx="${cx}" cy="${cy-4}" r="3.3" fill="#0f2427" stroke="${Lg.col}" stroke-width="1.5"/>`:`<rect x="${cx-3.2}" y="${cy-7.2}" width="6.4" height="6.4" fill="#0f2427" stroke="${Lg.col}" stroke-width="1.5"/>`;return mk+`<text x="${cx+7}" y="${cy}" font-size="${fs}" fill="#cfe">${esc((n=>Lg.lab.length>n?Lg.lab.slice(0,n-1)+'…':Lg.lab)(Math.max(12,Math.floor((cw-16)/6.2))))}</text>`;}).join('');}
    o+=LAGS.map((Lg,i)=>{const cx=L+8+(pw>560?i:i%2)*cw,cy=P2.y0+P2.h+12+(pw>560?0:(i>>1)*13);return `<circle cx="${cx}" cy="${cy-4}" r="3.5" fill="${Lg.col}"/><text x="${cx+7}" y="${cy}" font-size="${fs}" fill="#cfe">${Lg.lab.replace(' low-plateau',' low plateau')}</text>`;}).join('');}
  // panel 3: Mimdale
  let Y3=null;
  if(P3){const a=thin(S.mimdale||[],v0,v1,maxN);let mn=Infinity,mx=-Infinity;for(const p of a){mn=Math.min(mn,p[1]);mx=Math.max(mx,p[1]);}
    if(!isFinite(mn)){mn=0;mx=1;}if(mx-mn<0.2){const c=(mx+mn)/2;mn=c-0.1;mx=c+0.1;}
    Y3=v=>P3.y0+P3.h-(v-mn)/(mx-mn)*P3.h;o+=`<rect x="${L}" y="${P3.y0}" width="${pw}" height="${P3.h}" fill="none" stroke="#25464b"/>`;
    o+=`<text x="${L-4}" y="${P3.y0+10}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${mx.toFixed(2)}</text><text x="${L-4}" y="${P3.y0+P3.h}" text-anchor="end" font-size="${fs}" fill="#9db5b1">${mn.toFixed(2)}</text>`;
    let d='';a.forEach((p,i)=>{d+=(i?'L':'M')+X(p[0]).toFixed(1)+','+Y3(p[1]).toFixed(1);});
    o+=`<clipPath id="gc3"><rect x="${L}" y="${P3.y0}" width="${pw}" height="${P3.h}"/></clipPath><path clip-path="url(#gc3)" d="${d}" fill="none" stroke="#b48cff" stroke-width="1.8"/><text x="${L+4}" y="${P3.y0+12}" font-size="${fs}" fill="#9db5b1">Mimdale 539132 (m) — fresh-flow indicator</text>`;}
  o+=`<g id="gCur"></g>`;
  svg.innerHTML=o;G={X,v0,v1,L,pw,W,Ht,vis,Y1,P1,SPL};}

/* ---------- interaction ---------- */
const ptrs=new Map();let drag=null;
function tip(clientX){if(!G)return;const svg=$('gChart'),rc=svg.getBoundingClientRect();const sx=(clientX-rc.left)*(G.W/rc.width);if(sx<G.L||sx>G.L+G.pw){$('gTip').style.display='none';$('gCur').innerHTML='';return;}
  const m=G.v0+(sx-G.L)/G.pw*(G.v1-G.v0);const S=D.series;let rows=[];
  for(const s of SER){if(!on[s.id]||s.k==='panel')continue;let v=null;
    if(s.k==='step'){const p=lastVal(S[s.id]||[],m);v=p&&m-p[0]<720?p[1]:null;}
    else{const a=s.k==='model'?(G.vis[s.id]||[]):S[s.id]||[];let i=0;while(i<a.length&&a[i][0]<m)i++;if(i>0&&i<a.length&&a[i][0]-a[i-1][0]<180){const f=(m-a[i-1][0])/(a[i][0]-a[i-1][0]);v=a[i-1][1]+f*(a[i][1]-a[i-1][1]);}}
    if(v!=null)rows.push(`<span style="color:${s.col}">●</span> ${esc(s.lab)}: <b>${v.toFixed(2)}</b>`);}
  if(on.mimdale){const p=lastVal(S.mimdale||[],m);if(p)rows.push(`<span style="color:#b48cff">●</span> Mimdale: <b>${p[1].toFixed(2)}</b>`);}
  if(G.SPL&&G.SPL.length)rows.push(...FT.gSpots.tipRows(G.SPL,m,Math.max(20,(G.v1-G.v0)/G.pw*14)));
  const tp=$('gTip');tp.innerHTML=`<b>${fDT(m)}</b><br>`+rows.join('<br>');tp.style.display='block';
  const wx=svg.parentNode.clientWidth;const px=(sx/G.W)*rc.width;tp.style.left=Math.max(0,Math.min(px+10,wx-tp.offsetWidth-2))+'px';tp.style.top='30px';
  $('gCur').innerHTML=`<line x1="${sx}" x2="${sx}" y1="${G.P1.y0}" y2="${G.Ht-18}" stroke="#fff" stroke-width="1" opacity=".6"/>`;}
function zoom(f,cx){if(!view)return;const c=cx!=null?cx:(view[0]+view[1])/2;view=[c-(c-view[0])*f,c+(view[1]-c)*f];document.querySelectorAll('.gbar [data-r]').forEach(x=>x.classList.remove('on'));draw();}
function svgX(e){const rc=$('gChart').getBoundingClientRect();return (e.clientX-rc.left)*(G.W/rc.width);}
function mAt(e){return G.v0+(svgX(e)-G.L)/G.pw*(G.v1-G.v0);}
function bind(){const svg=$('gChart');
  svg.addEventListener('pointerdown',e=>{ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.setPointerCapture(e.pointerId);
    if(ptrs.size===1)drag={x0:e.clientX,v:view.slice(),moved:false};
    else if(ptrs.size===2){const [a,b]=[...ptrs.values()];drag={pinch:Math.abs(a.x-b.x)||1,v:view.slice(),cm:mAt({clientX:(a.x+b.x)/2}),moved:true};}});
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
if(FT.gSpots){FT.gSpots.ui();FT.gSpots.setOnChange(()=>{if(!D||!view)return;const fe=FT.gSpots.futureEnd();if(fe&&view[1]<nowM()+20*60){const w=view[1]-view[0];view=[nowM()+36*60-w,nowM()+36*60];}latest();draw();});}
FT.onTab=FT.onTab||[];FT.onTab.push(t=>{shown=t==='gauges';if(shown){if(!D)load(true);else{load(false);draw();}}});
setInterval(()=>{if(document.visibilityState==='visible'&&shown)load(true);},10*60e3);
setInterval(()=>{if(shown)upd();},30e3);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&shown)load(false);});
FT.gaugesReload=()=>load(true);
FT.gaugesView=(a,b)=>{view=[a,b];draw();};
window.__FT_GAUGES=()=>({D,view});
})();
