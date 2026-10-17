/* Run-in start times along Baffle Creek (shared by Bite times + Baffle tides tabs).
   Returns [{t (model hours), u (± min), kind:'low'|'rise'}].
   - Up to the Hills Rd node (25.24 km, incl. Euleilah Ck): the along-creek model's low turns (benchmark corrections included).
   - Upper creek (lows truncated to a pool level): 'water starts rising' time, calibrated from BoM 039267 Essendean
     2–9 Oct 2026 (n=10): rise start = Bundaberg HW + (10.20 − 2.48·H_LAT) h, clamped 2–5 h, resid sd 0.46 h.
     Between 25.24 and 35.25 km the two are blended by distance, with extra uncertainty mid-way.
   - Skipped where the modelled high at that spot is weak or a tide stand (single-high day: the small high doesn't reach). */
(function(){const BT=window.BT;if(!BT)return;
const KH=25.24,KE=35.25,RISE_A=10.20,RISE_B=-2.48,RISE_U=60;
BT.RISE={a:RISE_A,b:RISE_B,u:RISE_U};
BT.runInStarts=function(km,h0,h1,opts){opts=opts||{};const hoff=opts.hoff||0;
  const P=BT.predictAt(km,h0,h1,opts);
  if(km<=KH+0.01)return P.ext.filter(e=>!e.hi&&e.t>=h0-6&&e.t<=h1+6).map(e=>({t:e.t,u:e.u,kind:'low'})); /* lows before a tide stand are already merged away */
  const f=Math.min(1,(km-KH)/(KE-KH));
  const cH=BT.applyCorr(BT.calAt(KH,opts),opts.corr);
  const corrLw=(P.cal.corr&&P.cal.corr.lw)||0;
  const B=BT.bundExtremes(h0-16,h1+4);const out=[];
  for(let i=1;i<B.length;i++){const hw=B[i],lw=B[i-1];if(!hw.hi||lw.hi)continue;
    const lag=Math.max(2,Math.min(5,RISE_A+RISE_B*(hw.h+hoff)));
    const tE=hw.t+lag+corrLw/60,tH=lw.t+cH.lwLag/60,t=tH+(tE-tH)*f;
    const nh=P.ext.find(e=>e.hi&&e.t>t&&e.t-t<7);if(nh&&nh.weak)continue;
    const u=(1-f)*cH.lwU+f*RISE_U+40*4*f*(1-f)+(km>KE?(km-KE)*15:0); /* beyond Essendean: extrapolated */
    if(t>=h0-6&&t<=h1+6)out.push({t,u,kind:f>=0.5?'rise':'low'});}
  return out;};
})();
