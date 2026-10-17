/* ---- lure colour (injected into the Bite times closure) ----
   FT.lureAt(spot{km,line,lat,lng},t) → FTLure advice from the spot's own predicted tide stage/range at t, sun/moon, the loaded
   forecast weather (if it covers t), recent rain and the flood cycle. */
const lureCache=new Map();
function lureDay(spot,ds){const k=ds+'|'+(spot.km!=null?(+spot.km).toFixed(2)+(spot.line||''):spot.lat.toFixed(3)+','+spot.lng.toFixed(3))+'|'+(state&&state.runId||0);
  let v=lureCache.get(k);if(v)return v;if(lureCache.size>300)lureCache.clear();
  const tz='Australia/Brisbane';let r=null;
  if(spot.km!=null&&window.BT){try{r=baffleTide(ds,spot.km,spot.line);}catch(e){r=null;}}
  let mx=0;if(r)for(let i=1;i<r.ext.length;i++)mx=Math.max(mx,Math.abs(r.ext[i].h-r.ext[i-1].h));
  const dd=MJ.computeDay(Object.assign({dateStr:ds,tz,lat:spot.lat,lng:spot.lng,wxFn:state&&state.wxFn,fresh:state&&state.fresh},r?{tideFn:r.fn,ext:r.ext,runIn:r.runIn,weekRange:r.ext.length>1?{max:mx}:null}:{}));
  v={dd,r,mx};lureCache.set(k,v);return v;}
function lureMaxKm(spot){if(spot.km==null||!window.BT)return null;try{return BT.lineMaxKm?BT.lineMaxKm(spot.line||(BT.generic?'M':'B')):(BT.lineMax?BT.lineMax(spot.line||'M'):BT.MAXKM);}catch(e){return null;}}
function lureFromPt(p,spot,V,t){const T=p.T;let stage=null,range=null;
  if(T){stage=T.stage!=null?T.stage:(T.prev&&T.next?(MJ.stageAt(t,[T.prev,T.next],V.r?V.r.runIn:[])||{}).c:null);if(T.prev&&T.next)range=Math.abs(T.next.h-T.prev.h);}
  const w=p.wx||null;let rain24=null;const wf=state&&state.wxFn;
  if(wf){let s=0,n=0;for(let h=0;h<24;h++){const x=wf(t-h*3600e3);if(x&&x.rain!=null){s+=x.rain;n++;}}if(n>=12)rain24=s*24/n;}
  const fl=state&&state.fresh&&MJ.floodAdj?MJ.floodAdj(state.fresh,t):null;
  const il=MJ.moonIllum(t);
  return FTLure.advise({depth:spot.depth||null,stage,range,rangeMax:V.mx||null,tide:!!T,km:spot.km,maxKm:lureMaxKm(spot),flood:fl,rain24,rain:w&&w.rain,wind:w&&w.wind,cloud:w&&w.cloud,code:w&&w.code,alt:p.alt,moon:il.fraction});}
FT.lureAt=function(spot,t){try{const ds=MJ.ymd(t,'Australia/Brisbane');const V=lureDay(spot,ds);const d=V.dd;
  const p=d.pts[Math.max(0,Math.min(d.pts.length-1,Math.round((t-d.t0)/(15*60e3))))];return p?lureFromPt(p,spot,V,t):null;}catch(e){console.error('lure',e);return null;}};
FT.lureHtml=(spot,t,full)=>FTLure.html(FT.lureAt(spot,t),full);
/* Bite tab card: now (if the selected day is today) else the best window; chart touch moves it */
let lureT=null;
function lureSpot(){const l=loc.spotId&&FT.spots?FT.spots.get(loc.spotId):null;return{depth:l&&l.depth||null,km:loc.baffleKm!=null?loc.baffleKm:null,line:loc.baffleLine||null,lat:loc.lat,lng:loc.lng};}
function renderLure(p){const el=$('lure');if(!el||!state||!state.days)return;const d=state.days[state.sel];if(!d)return;
  let pt=p;if(!pt){const now=Date.now();if(now>=d.t0&&now<d.t1)pt=d.pts[Math.round((now-d.t0)/(15*60e3))];else{const W=(d.windows||[]).slice().sort((a,b)=>b.score-a.score)[0];pt=W?W.peak:d.pts[Math.floor(d.pts.length/2)];}}
  if(!pt)return;lureT=pt.t;const V={r:null,mx:null};try{const sp=lureSpot();if(sp.km!=null&&window.BT){const v=lureDay(sp,d.dateStr);V.r=v.r;V.mx=v.mx;}}catch(e){}
  const r=lureFromPt(pt,lureSpot(),V,pt.t);
  el.innerHTML=`<h3 style="margin:10px 0 4px;font-size:.95rem">🎨 Lure colour <span class="mut" style="font-weight:400">· ${fmtT(pt.t,state.tz)}${p?'':Date.now()>=d.t0&&Date.now()<d.t1?' (now)':' (best window)'} · guide</span></h3>${FTLure.html(r,true)}<details class="dc" data-k="lureinfo"${FT.dcOpen&&FT.dcOpen('lureinfo')?' open':''}><summary>How the lure guide works</summary><p class="mut" style="margin:2px 0 0;font-size:.74rem">Estimated water clarity (tide stage &amp; range, km up the creek, flood/rain, wind) × light (sun, cloud, moon). Touch the chart to see another time. A guide only — log the colour you used in the 📝 Catch log to test it.</p></details>`;
  document.body.dataset.lure=r.keys.join(',');}
