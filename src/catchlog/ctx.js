/* ---- Catch log hooks (injected into the Bite times closure) ----
   FT.biteCtx(spot,t0,t1): predicted context for every 15-min slot of a fishing session at a spot.
   Re-uses the open Bite-times forecast (incl. weather & SST) when it is for the same spot & dates,
   otherwise recomputes offline: Baffle along-creek model for creek spots, no-tide scoring off-creek. */
FT.biteLoc=()=>({name:loc.name,lat:loc.lat,lng:loc.lng,km:loc.baffleKm,line:loc.baffleLine,sys:loc.sys,spotId:loc.spotId||null,stype:state&&state.spotType||null});
FT.biteCtx=function(spot,t0,t1){
  const tz='Australia/Brisbane',Q=15*60e3;
  t0=Math.floor(t0/Q)*Q;t1=Math.max(t0+Q,Math.ceil(t1/Q)*Q);
  const dates=[];for(let t=t0;t<t1;t+=Q){const ds=MJ.ymd(t,tz);if(!dates.includes(ds))dates.push(ds);}
  const dist=(a,b)=>{const R=6371,r=Math.PI/180,dx=(b.lng-a.lng)*r*Math.cos((a.lat+b.lat)/2*r),dy=(b.lat-a.lat)*r;return R*Math.hypot(dx,dy);};
  let days=null,runIn=[],src,tideSrc;
  /* typed spot (Run-in / TOT / BOT / Run-out): its tide score is shaped by that preferred stage */
  let ST=spot.stype!==undefined?spot.stype:null;
  if(ST==null&&spot.spotId&&FT.spots){const l=FT.spots.get(spot.spotId);ST=l&&l.type||null;}
  if(!ST||!MJ.STYPES[ST])ST=null;
  const sd=state&&state.days;
  const sameLine=!window.BT||!BT.generic||((spot.line||'M')===(loc.baffleLine||'M'));
  const same=sd&&sd.length&&(state.spotType||null)===ST&&(spot.km!=null?(loc.baffleKm!=null&&sameLine&&Math.abs(spot.km-loc.baffleKm)<1):(loc.baffleKm==null&&dist(spot,loc)<3));
  if(same&&dates.every(ds=>sd.some(d=>d.dateStr===ds))){
    days=dates.map(ds=>sd.find(d=>d.dateStr===ds));runIn=sd.flatMap(d=>d.runIns||[]);src='bite';
    tideSrc=loc.baffleKm!=null?'baffle':(state.hasTide?'marine':'none');}
  else if(spot.km!=null&&window.BT){
    const r=baffleTide(dates[0],spot.km,spot.line);let mx=0;for(let i=1;i<r.ext.length;i++)mx=Math.max(mx,Math.abs(r.ext[i].h-r.ext[i-1].h));
    const wr=r.ext.length>1?{max:mx}:null;
    days=dates.map(ds=>MJ.computeDay({dateStr:ds,tz,lat:spot.lat,lng:spot.lng,tideFn:r.fn,ext:r.ext,runIn:r.runIn,weekRange:wr,spotType:ST}));
    runIn=r.runIn;src='model';tideSrc='baffle';}
  else{days=dates.map(ds=>MJ.computeDay({dateStr:ds,tz,lat:spot.lat,lng:spot.lng}));src='model';tideSrc='none';}
  const slots=[];let wx=false;
  for(let t=t0;t<t1;t+=Q){const d=days.find(d=>t>=d.t0&&t<d.t1);if(!d)continue;const p=d.pts[Math.round((t-d.t0)/Q)];if(!p)continue;
    let ri=null;if(tideSrc!=='none'){let best=null;for(const r of runIn){if(r.t<=t+60*60e3&&(best==null||r.t>best.t))best=r;}if(best&&t-best.t<=13*3600e3)ri=Math.round((t-best.t)/60e3);}
    const w=p.wx;if(w)wx=true;
    slots.push({t,score:p.score,tl:p.T?p.T.label:null,rising:p.T?!!p.T.rising:null,ri,alt:Math.round(p.alt*10)/10,
      sol:p.S&&p.S.v>0?(p.S.major?'major':'minor'):'none',
      wind:w&&w.wind!=null?Math.round(w.wind):null,cloud:w&&w.cloud!=null?Math.round(w.cloud):null,p:w&&w.p!=null?Math.round(w.p):null,dp3:w&&w.dp3!=null?Math.round(w.dp3*10)/10:null,
      sst:p.sst!=null?Math.round(p.sst*10)/10:null,
      stg:p.T?(p.T.stage!=null?p.T.stage:MJ.stageAt(t,[p.T.prev,p.T.next].filter(Boolean),runIn).c)||null:null});}
  const il=MJ.moonIllum((t0+t1)/2);
  return{src,tideSrc,wx,stype:ST,moon:{phase:Math.round(il.phase*1000)/1000,illum:Math.round((il.fraction!=null?il.fraction:0)*100)/100},slots};};
