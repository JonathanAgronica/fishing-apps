/* ===== Baffle live tide adjustments (coastal surge + Mimdale fresh) =====
   Data: data/baffle_adj.json (scripts/baffle_adj.py, refreshed by the hourly gauge routine).
   - surge(t): Bundaberg trailing 25 h mean residual (obs − MSQ pred); gain 1, capped ±0.3 m; all Baffle reaches
     (main channel, Euleilah, side creeks), highs and lows (pool-level lows above ~30 km: only a positive surge lifts them). Past = archived hourly series; after the last value it
     fades (e-fold 24 h) and is 0 from 48 h on — later dates are unchanged.
   - F(t) = max(0, Mimdale(t−3 h) − M0), M0 = 10th percentile of the previous 14 d. Highs += 0.5·F·w(km) on the main
     channel only, w = ((km−16.4)/18.85)^1.5 clipped 0..1 (0 at/below the Euleilah junction, 1 at Essendean and above);
     single-high threshold += F·w/0.423 (same as the upper-creek base adj, but lows are not raised). Fades e-fold 48 h, 0 from 72 h.
   The Baffle core reads window.BT_ADJ in predictAt (opts.adj===null disables). No data → no adjustment (identical output). */
(function(root){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function make(J){if(!J||!J.series||!J.params)return null;const P=J.params,C=J.cols||['t','surge','F'],iS=C.indexOf('surge'),iF=C.indexOf('F');
  const S=J.series.filter(r=>r[0]!=null),T=S.map(r=>r[0]/60);/* model hours */
  const L=J.live||{},tS=L.surge_t!=null?L.surge_t/60:null,tF=L.F_t!=null?L.F_t/60:null,s0=+L.surge||0,f0=+L.F||0;
  const fade=(dt,tau,cut)=>dt<=0?1:dt>=cut?0:Math.exp(-dt/tau)*Math.min(1,(cut-dt)/(cut*0.25));
  function at(t,i){/* linear interpolation in the hourly series (null → 0); 0 before the record */
    if(!T.length||t<T[0])return 0;let lo=0,hi=T.length-1;if(t>=T[hi])return +S[hi][i]||0;
    while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=t)lo=m;else hi=m;}const a=+S[lo][i]||0,b=+S[hi][i]||0;return a+(b-a)*(t-T[lo])/(T[hi]-T[lo]);}
  const surge=t=>tS==null?0:t<=tS?at(t,iS):s0*fade(t-tS,P.surge_tau_h,P.surge_cut_h);
  const fresh=t=>tF==null?0:t<=tF?at(t,iF):f0*fade(t-tF,P.f_tau_h,P.f_cut_h);
  const w=km=>Math.pow(clamp((km-P.w_j)/P.w_span,0,1),P.w_pow);
  const A={J,P,surge,fresh,w,
    surgeM:t=>clamp(P.gain*surge(t),-P.cap,P.cap),
    dh(km,t,hi,line,trunc){let s=clamp(P.gain*surge(t),-P.cap,P.cap);if(trunc&&!hi&&s<0)s=0;/* pool-level lows (upper creek) are bed/fresh-held: setup can lift them, a negative residual can't drain them */const f=line==='B'?(hi?P.kH:P.kL)*fresh(t)*w(km):0;return s+f;},
    sup(km,t,line){return line==='B'?fresh(t)*w(km)/P.sup_div:0;},
    flood:!!L.flood,live:L};
  return A;}
const LS='ft_baffle_adj';
const ADJ={make,cur:null,onChange:[],ver:0,
  set(J,silent){const a=make(J);if(!a)return;const old=ADJ.cur&&ADJ.cur.J&&ADJ.cur.J.generated;ADJ.cur=a;root.BT_ADJ=a;ADJ.ver++;
    if(!silent&&old!==J.generated)ADJ.onChange.forEach(f=>{try{f(a)}catch(e){console.error('adj',e)}});},
  async load(){try{const r=await fetch('data/baffle_adj.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const J=await r.json();
      if(!J||!J.series)return;try{localStorage.setItem(LS,JSON.stringify(J));}catch(e){}ADJ.set(J);}catch(e){console.warn('baffle_adj',e);}},
  /* summary at model hour t for a spot (km, line); null when no data */
  info(t,km,line){const a=ADJ.cur;if(!a)return null;const s=a.surgeM(t),F=a.fresh(t),E=a.P.kH*F*a.w(35.25),here=km!=null&&line==='B'?a.P.kH*F*a.w(km):null;
    return{s,F,E,here,sup:km!=null?a.sup(km,t,line||'B'):0,M0:a.live.M0,mim:a.live.mimdale,minor:a.live.mim_minor,flood:a.flood,gen:a.J.generated,
      wind:s>0.015?'wind/pressure set-up':s<-0.015?'wind/pressure set-down':''};},
  cm:x=>(x>=0?'+':'−')+Math.abs(Math.round(x*100))+' cm',
  line(t,km,line){const I=ADJ.info(t,km,line);if(!I)return '';const cm=ADJ.cm;
    let s=`Live adj: ${cm(I.s)} surge${I.wind?' ('+I.wind+')':''}, ${cm(I.E)} fresh at Essendean highs`;
    if(I.here!=null&&km!=null&&Math.abs(km-35.25)>0.5)s+=` (${cm(I.here)} here)`;
    return s;},
  badge(t,km,line){const I=ADJ.info(t,km,line);if(!I)return '';const cm=ADJ.cm;const tot=I.s+(I.here||0);if(Math.abs(I.s)<0.005&&I.E<0.005&&!I.flood)return '';
    return `<span class="adjb" title="${ADJ.line(t,km,line).replace(/"/g,'&quot;')}">⚖ live adj ${cm(I.s)} surge${I.E>=0.005?' · '+cm(I.here!=null?I.here:I.E)+' fresh'+(I.here!=null?'':' (Essendean)'):''}</span>`;},
  floodHtml(){const I=ADJ.info(0);if(!I||!I.flood)return '';return `<div class="notice err">🌊 <b>Mimdale is above its minor flood level</b> (${I.mim!=null?I.mim.toFixed(2):'?'} m ≥ ${I.minor} m). The upper creek may be <b>non-tidal / fresh-dominated</b> — tide times and heights above ~25 km are unreliable; the live fresh adjustment only covers small freshes.</div>`;}};
root.FTADJ=ADJ;
if(root.FT&&root.FT.SYS&&root.FT.SYS!=='baffle')return; /* other systems: never adjusted */
try{const J=JSON.parse(localStorage.getItem(LS)||'null');if(J)ADJ.set(J,true);}catch(e){}
if(typeof fetch==='function'&&typeof location!=='undefined')ADJ.load();
setInterval&&typeof document!=='undefined'&&setInterval(()=>{if(!document.hidden)ADJ.load();},20*60e3);
})(typeof window!=='undefined'?window:globalThis);
