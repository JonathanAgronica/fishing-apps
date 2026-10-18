/* ===== Multi-system tide engine =====
   FT.makeSystemBT(S) turns a data/systems/<id>.json file into an object with the same API as the Baffle model (window.BT),
   so every tab works unchanged on any tidal creek/river. Baffle Creek itself keeps its own hand-calibrated BT (no regression).
   Model: base-port harmonics (MSQ official predictions, fitted offline) → each high/low shifted by a lag and mapped in height
   (linear in the base-port height) at calibration nodes along the channel (MSQ secondary places, MSQ/BoM gauges, generic
   extrapolation to the estimated tidal limit), interpolated by chainage. Heights ≈ m AHD (local MSL). */
(function(){'use strict';
const FT=window.FT,B0=window.BT,RAD=Math.PI/180;
function makeSystemBT(S){
  const H=S.port.harm;const fuAll=B0.fuAll;
  let fc={k:null,v:null};
  function portH(h){const k=Math.floor(h/24);if(fc.k!==k)fc={k,v:fuAll(k*24+12)};const F=fc.v;let z=H.z0;
    for(let i=0;i<H.names.length;i++){const fu=F[H.names[i]];z+=fu[0]*H.amp[i]*Math.cos((H.speeds[i]*h+fu[1]-H.pha[i])*RAD);}return z;}
  function portExtremes(t0,t1){const st=0.1,out=[];let a=portH(t0-st),b=portH(t0);
    for(let t=t0+st;t<=t1+1e-9;t+=st){const c=portH(t);if((b>a&&b>=c)||(b<a&&b<=c)){const den=a-2*b+c,off=den?0.5*(a-c)/den:0;out.push({t:t-st+off*st,h:b-0.25*(a-c)*off,hi:b>a});}a=b;b=c;}
    const f=[];for(const x of out){const l=f[f.length-1];if(l&&l.hi===x.hi){if((x.hi&&x.h>l.h)||(!x.hi&&x.h<l.h))f[f.length-1]=x;}else if(l&&Math.abs(l.h-x.h)<0.05){f.pop();}else f.push(x);}return f;}
  const mk=n=>Object.assign({},n,{hwLvl:Hh=>n.hw[0]+n.hw[1]*Hh,lwLvl:L=>{const v=n.lw[0]+n.lw[1]*L;return n.trunc?Math.max(n.floor,v):v;}});
  const NBY={};for(const id in S.nodes)NBY[id]=S.nodes[id].map(mk);
  const NODES=NBY.M;
  const LMAX={};S.lines.forEach(l=>LMAX[l.id]=l.junctionKm+l.limitKm);
  const MAXKM=S.maxKm;
  function calAt(km,opts){opts=opts||{};const line=NBY[opts.line]?opts.line:'M';const N=NBY[line];km=Math.max(0,Math.min(LMAX[line]||MAXKM,km));
    let i=0;while(i<N.length-2&&km>N[i+1].km)i++;
    const a=N[i],b=N[Math.min(i+1,N.length-1)];const beyond=km>b.km+1e-6;const span=Math.max(1e-6,b.km-a.km);const f=beyond?1:Math.max(0,Math.min(1,(km-a.km)/span));
    const gap=Math.min(Math.abs(km-a.km),Math.abs(km-b.km));const L=(x,y)=>x+(y-x)*f;const badj=opts.badj||0;
    const gen=f>0.5?!!b.generic:!!a.generic;
    return{km,line,beyond,nodeA:a,nodeB:b,f,hwLag:L(a.hwLag,b.hwLag),lwLag:L(a.lwLag,b.lwLag),
      hwU:L(a.hwU,b.hwU)+(beyond?(km-b.km)*10:gap*(span>10?3:1)),lwU:L(a.lwU,b.lwU)+(beyond?(km-b.km)*15:gap*(span>10?4:1)),
      hwLvl:x=>L(a.hwLvl(x),b.hwLvl(x)),lwLvl:x=>L(a.lwLvl(x)+(a.trunc?badj:0),b.lwLvl(x)+(b.trunc?badj:0)),
      est:(span>10&&gap>3)||beyond||!!b.generic&&f>0.15||gen,generic:!!b.generic&&f>0.15,trunc:f>0.5&&!!b.trunc};}
  const applyCorr=(cal,corr)=>B0.applyCorr(cal,corr&&corr.filter(c=>!c.line||c.line===cal.line));
  function predictAt(km,t0,t1,opts){opts=opts||{};let cal=applyCorr(calAt(km,opts),opts.corr);const hoff=opts.hoff||0;
    const base=portExtremes(t0-14,t1+14);
    let ext=base.map(e=>{const Hh=e.h+hoff;return e.hi?{t:e.t+cal.hwLag/60,h:cal.hwLvl(Hh),hi:true,u:cal.hwU,src:e}:{t:e.t+cal.lwLag/60,h:cal.lwLvl(Hh),hi:false,u:cal.lwU,src:e};});
    ext.sort((a,b)=>a.t-b.t);
    if(cal.nodeB.trunc||cal.nodeA.trunc){for(let i=0;i<ext.length;i++){const e=ext[i];if(e.hi){const nb=[ext[i-1],ext[i+1]].filter(x=>x&&!x.hi);const fl=nb.length?Math.max(...nb.map(x=>x.h)):-9;e.rise=e.h-fl;if(e.h<fl+0.05)e.weak=true;}}}
    const clean=[];for(const e of ext){const l=clean[clean.length-1];if(l&&l.hi===e.hi){if((e.hi&&e.h>l.h)||(!e.hi&&e.h<l.h))clean[clean.length-1]=e;}else clean.push(e);}
    const curve=t=>{let i=0;while(i<clean.length-2&&clean[i+1].t<t)i++;const a=clean[i],b=clean[i+1];if(!a||!b||t<a.t||t>b.t)return null;const f=(t-a.t)/(b.t-a.t);return a.h+(b.h-a.h)*(1-Math.cos(Math.PI*f))/2;};
    return{cal,ext:clean,curve,inWin:clean.filter(e=>e.t>=t0&&e.t<t1)};}
  function runInStarts(km,h0,h1,opts){const P=predictAt(km,h0,h1,opts);const tr=P.cal.trunc;
    return P.ext.filter((e,i)=>!e.hi&&e.t>=h0-6&&e.t<=h1+6&&!(tr&&P.ext[i+1]&&P.ext[i+1].weak)).map(e=>({t:e.t,u:e.u,kind:tr?'rise':'low'}));}
  /* geometry */
  const havKm=(a,b)=>{const la1=a[0]*RAD,la2=b[0]*RAD,dl=(b[0]-a[0])*RAD,dn=(b[1]-a[1])*RAD;const x=Math.sin(dl/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dn/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(x));};
  const LINES=S.lines.map(l=>{const c=[0];for(let i=1;i<l.coords.length;i++)c.push(c[i-1]+havKm(l.coords[i-1],l.coords[i]));return Object.assign({},l,{cc:c,len:c[c.length-1],j:l.junctionKm||0});});
  const LBYID={};LINES.forEach(l=>LBYID[l.id]=l);
  function projLine(L,lat,lon){const line=L.coords,cc=L.cc;const kx=111.32*Math.cos(lat*RAD),ky=110.54;let best={d:1e9};
    for(let i=0;i<line.length-1;i++){const ax=(line[i][1]-lon)*kx,ay=(line[i][0]-lat)*ky,bx=(line[i+1][1]-lon)*kx,by=(line[i+1][0]-lat)*ky;const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));const d=Math.hypot(ax+t*dx,ay+t*dy);
      if(d<best.d)best={d,s:cc[i]+t*(cc[i+1]-cc[i]),lat:line[i][0]+t*(line[i+1][0]-line[i][0]),lon:line[i][1]+t*(line[i+1][1]-line[i][1])};}return best;}
  function snap(lat,lon){let best=null;for(const L of LINES){const p=projLine(L,lat,lon);if(!best||p.d<best.p.d-(L.id==='M'?0:0.03))best={L,p};}
    const L=best.L,p=best.p;return{km:L.j+p.s,offKm:p.d,line:L.name,lineId:L.id,lat:p.lat,lon:p.lon,alongKm:p.s};}
  function pointOnLine(km,id){const L=LBYID[id]||LBYID.M;const s=Math.max(0,Math.min(L.len,km-L.j));const c=L.coords,cc=L.cc;
    for(let i=1;i<cc.length;i++)if(cc[i]>=s){const f=(s-cc[i-1])/((cc[i]-cc[i-1])||1);return[c[i-1][0]+f*(c[i][0]-c[i-1][0]),c[i-1][1]+f*(c[i][1]-c[i-1][1])];}return c[c.length-1];}
  const pointAtKm=km=>pointOnLine(km,'M');
  function lineName(id){const L=LBYID[id];return L?L.name:S.name;}
  /* two chainages are on the same reach (for 'nearest spot') */
  function sameReach(km1,l1,km2,l2){if(l1===l2)return true;const a=LBYID[l1],b=LBYID[l2];
    const onMainBelow=(km,L)=>L&&km<=L.j+1e-6;return (a&&a.id!=='M'&&l2==='M'&&onMainBelow(km2,a))||(b&&b.id!=='M'&&l1==='M'&&onMainBelow(km1,b));}
  const LANDMARKS=S.landmarks.map(l=>Object.assign({},l));
  const lineMax=id=>LMAX[id]||MAXKM;
  const calN=NODES.filter(n=>n.kind==='bom'||n.kind==='msq'||n.kind==='gaugefit');
  const REFKM=calN.length?calN[calN.length-1].km:LMAX.M;const REFNAME=calN.length?calN[calN.length-1].name:'tidal limit';
  const dl=LANDMARKS.filter(l=>l.line==='M'&&l.km>0.2&&(l.ramp||l.cal));const DEFKM=dl.length?dl[0].km:Math.min(1,LMAX.M);
  const R=Object.assign({},B0,{generic:true,SYS:S,bundH:portH,bundExtremes:portExtremes,portH,portExtremes,officialHiLo:()=>[],NODES,calAt,predictAt,runInStarts,
    snap,pointAtKm,pointOnLine,lineName,sameReach,LINES,LANDMARKS,MAXKM,applyCorr,RISE:null,NBY,lineMax,REFKM,REFNAME,DEFKM});
  let X=S.twoEnt?addTwoEnt(R,S.twoEnt):R;
  /* further two-entrance channels in the same system (2026-10-18: Pancake Ck ↔ Jenny Lind Ck link): each wraps the previous model and only takes over its own line */
  if(S.twoEnt&&S.twoEntMore)for(const te of S.twoEntMore)X=addTwoEnt(X,te);
  return X;}
/* ===== Two-entrance passages (S.twoEnt, e.g. Pumicestone Passage: Bribie bridge south ↔ Caloundra bar north) =====
   South wave: the normal node model on the base port (calibrated nodes up to TE.X0, then lag growth + attenuation).
   North wave: second port (Mooloolaba) through the north nodes (TE.nn, y = km from the north entrance).
   Water level = (1−wN)·south + wN·north, wN a logistic weight centred on the tidal node (0 at/below X0, 1 at/above X1);
   highs/lows are the turning points of the blended curve, so the node gets the small range and flattened, later highs.
   Side creeks in the blend reach: blended tide at the junction + the creek's own upstream lag / height transfer.
   Generalised 2026-10-18: TE.line puts the passage on any line (Burnett → Skyring Creek), names/labels come from TE (TWONM).
   Systems without twoEnt never reach this code (no regression). */
function makePort(H,fuAll){let fc={k:null,v:null};
  function h(t){const k=Math.floor(t/24);if(fc.k!==k)fc={k,v:fuAll(k*24+12)};const F=fc.v;let z=H.z0;
    for(let i=0;i<H.names.length;i++){const fu=F[H.names[i]];z+=fu[0]*H.amp[i]*Math.cos((H.speeds[i]*t+fu[1]-H.pha[i])*RAD);}return z;}
  function ext(t0,t1){const st=0.1,out=[];let a=h(t0-st),b=h(t0);
    for(let t=t0+st;t<=t1+1e-9;t+=st){const c=h(t);if((b>a&&b>=c)||(b<a&&b<=c)){const den=a-2*b+c,off=den?0.5*(a-c)/den:0;out.push({t:t-st+off*st,h:b-0.25*(a-c)*off,hi:b>a});}a=b;b=c;}
    const f=[];for(const x of out){const l=f[f.length-1];if(l&&l.hi===x.hi){if((x.hi&&x.h>l.h)||(!x.hi&&x.h<l.h))f[f.length-1]=x;}else if(l&&Math.abs(l.h-x.h)<0.05){f.pop();}else f.push(x);}return f;}
  return{h,ext};}
function addTwoEnt(R,TE){const B=R,NP=makePort(TE.north.harm,B0.fuAll),PRIM=!R.TWO,PREV={fedFrom:R.fedFrom,kmBoth:R.kmBoth};
  /* optional fields (defaults = Pumicestone): line = passage line id (km 0 at the 'south' entrance, TE.L at the other end;
     a side channel such as Burnett → Skyring Creek uses its own id), nodeBand = km range with extra node uncertainty,
     u0 = base ± min (HW, LW) on the passage, est = mark the whole passage as estimated,
     nOff = km of the far end along its own creek (labels count 'km from the far entrance' = L − km + nOff),
     floor = {km,h,span}: the channel drains near km (lows held at h there, fading out over ±span km; highs stay above the lows) */
  const PL=TE.line||'M',NB=TE.nodeBand||[18,30],U0=TE.u0||[12,16];
  const ca0=R.calAt,pa0=R.predictAt,LBY={};R.LINES.forEach(l=>LBY[l.id]=l);
  const NS=R.NBY[PL].filter(n=>n.km<=TE.X0+1e-6);
  const lerpN=(N,x,kx)=>{let i=0;while(i<N.length-2&&x>N[i+1][kx])i++;const a=N[i],b=N[Math.min(i+1,N.length-1)];const f=b[kx]>a[kx]?Math.max(0,Math.min(1,(x-a[kx])/(b[kx]-a[kx]))):0;
    const l=(p,q)=>p+(q-p)*f;return{hl:l(a.hwLag,b.hwLag),ll:l(a.lwLag,b.lwLag),hw:[l(a.hw[0],b.hw[0]),l(a.hw[1],b.hw[1])],lw:[l(a.lw[0],b.lw[0]),l(a.lw[1],b.lw[1])]};};
  function sPar(x){if(x<=TE.X0)return lerpN(NS,x,'km');const D=NS[NS.length-1],d=x-TE.X0,f=Math.exp(-TE.sx.att*d);
    return{hl:D.hwLag+TE.sx.hwRate*d,ll:D.lwLag+TE.sx.lwRate*d,hw:[D.hw[0]*f,D.hw[1]*f],lw:[D.lw[0]*f,D.lw[1]*f]};}
  const YN=TE.nn[TE.nn.length-1].y;
  function nPar(x){const y=TE.L-x;if(y<=YN)return lerpN(TE.nn,y,'y');const D=TE.nn[TE.nn.length-1],d=y-YN,f=Math.exp(-TE.nx.att*d);
    return{hl:D.hwLag+TE.nx.hwRate*d,ll:D.lwLag+TE.nx.lwRate*d,hw:[D.hw[0]*f,D.hw[1]*f],lw:[D.lw[0]*f,D.lw[1]*f]};}
  const lg=v=>1/(1+Math.exp(-(v-TE.node)/TE.w));
  function wN(x){return x<=TE.X0?0:x>=TE.X1?1:(lg(x)-lg(TE.X0))/(lg(TE.X1)-lg(TE.X0));}
  /* top-level junction on the passage for any line */
  function mainX(km,line){let L=LBY[line];if(PL==='M'){if(!L||L.id==='M')return{x:km,side:false};if(!L.parent)return null;let j=L.j;while(L.parent&&L.parent!=='M'&&LBY[L.parent]){L=LBY[L.parent];j=L.j;}return{x:j,side:true};}
    /* passage on a side channel: only that channel (and creeks off it) are in the blend; everything else → null */
    if(!L)return null;if(L.id===PL)return{x:km,side:false};let j=L.j;while(L.parent&&L.parent!==PL&&LBY[L.parent]){L=LBY[L.parent];j=L.j;}return L.parent===PL?{x:j,side:true}:null;}
  function wave(ext,p,hoff){return ext.map(e=>e.hi?{t:e.t+p.hl/60,h:p.hw[0]+p.hw[1]*(e.h+hoff),hi:true}:{t:e.t+p.ll/60,h:p.lw[0]+p.lw[1]*(e.h+hoff),hi:false}).sort((a,b)=>a.t-b.t);}
  function cos(E){let i=0;return t=>{while(i>0&&E[i].t>t)i--;while(i<E.length-2&&E[i+1].t<t)i++;const a=E[i],b=E[i+1];if(!b)return a.h;const f=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));return a.h+(b.h-a.h)*(1-Math.cos(Math.PI*f))/2;};}
  const ecache=new Map();
  function blended(x,t0,t1,hoff){const k=x.toFixed(3)+'|'+t0.toFixed(3)+'|'+t1.toFixed(3)+'|'+hoff;if(ecache.has(k))return ecache.get(k);
    const w=wN(x),a=t0-14,b=t1+14;let E;
    if(w<=0)E=wave(R.portExtremes(a-6,b+6),sPar(x),hoff);
    else if(w>=1)E=wave(NP.ext(a-6,b+6),nPar(x),hoff);
    else{const cs=cos(wave(R.portExtremes(a-6,b+6),sPar(x),hoff)),cn=cos(wave(NP.ext(a-6,b+6),nPar(x),hoff));const st=0.05,out=[];
      let p0=(1-w)*cs(a-st)+w*cn(a-st),p1=(1-w)*cs(a)+w*cn(a);
      for(let t=a+st;t<=b;t+=st){const p2=(1-w)*cs(t)+w*cn(t);if((p1>p0&&p1>=p2)||(p1<p0&&p1<=p2)){const den=p0-2*p1+p2,off=den?0.5*(p0-p2)/den:0;out.push({t:t-st+off*st,h:p1-0.25*(p0-p2)*off,hi:p1>p0});}p0=p1;p1=p2;}
      E=[];for(const e of out){const l=E[E.length-1];if(l&&l.hi===e.hi){if((e.hi&&e.h>l.h)||(!e.hi&&e.h<l.h))E[E.length-1]=e;}else if(l&&Math.abs(l.h-e.h)<0.03)E.pop();else E.push(e);}}
    if(ecache.size>300)ecache.clear();ecache.set(k,E);return E;}
  /* effective lag/height vs the base port (for Gauges tab drift, run-in and labels) — fitted once per spot over 15 days */
  const effC=new Map();
  function eff(x,line){const k=line+'|'+x.toFixed(2);if(effC.has(k))return effC.get(k);
    const t0=6600,t1=t0+360,P=R.portExtremes(t0-14,t1+14),E=blendSide(x,line,t0,t1,0).ext;const acc={true:{L:[],X:[],Y:[]},false:{L:[],X:[],Y:[]}};
    for(const e of E){if(e.t<t0||e.t>t1)continue;let best=null,bd=9;for(const p of P){if(p.hi!==e.hi)continue;const d=e.t-p.t;if(d>-2.5&&d<4.5&&Math.abs(d-0.8)<Math.abs(bd-0.8)){bd=d;best=p;}}if(!best)continue;const A=acc[e.hi];A.L.push(bd*60);A.X.push(best.h);A.Y.push(e.h);}
    const fit=A=>{const n=A.X.length;if(n<3)return{lag:0,a:0,b:1};const L=A.L.slice().sort((p,q)=>p-q);const mx=A.X.reduce((s,v)=>s+v,0)/n,my=A.Y.reduce((s,v)=>s+v,0)/n;let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(A.X[i]-mx)**2;sxy+=(A.X[i]-mx)*(A.Y[i]-my);}const b=sxx?sxy/sxx:0;return{lag:L[n>>1],a:my-b*mx,b};};
    const r={hw:fit(acc.true),lw:fit(acc.false)};effC.set(k,r);return r;}
  function blendSide(km,line,t0,t1,hoff){const m=mainX(km,line);let E=blended(m.x,t0,t1,hoff),cS=null;
    if(m.side){cS=ca0(km,{line});const cJ=ca0(m.x,{line:PL});const dH=(cS.hwLag-cJ.hwLag)/60,dL=(cS.lwLag-cJ.lwLag)/60;
      const inv=(f,h)=>{const a=f(0),b=f(1)-a;return Math.abs(b)>1e-6?(h-a)/b:0;};
      E=E.map(e=>e.hi?{t:e.t+dH,h:cS.hwLvl(inv(cJ.hwLvl,e.h)),hi:true}:{t:e.t+dL,h:cS.lwLvl(inv(cJ.lwLvl,e.h)),hi:false});}
    return{ext:E,cS};}
  function inBlend(km,line){const m=mainX(km,line);return !!m&&m.x>TE.X0+1e-6;}
  function calAt(km,opts){opts=opts||{};const line=R.NBY[opts.line]?opts.line:'M';if(!inBlend(km,line))return ca0(km,opts);
    const base=ca0(km,opts);const k=Math.max(0,Math.min(R.lineMax(line),km));const m=mainX(k,line),w=wN(m.x),ef=eff(k,line);
    const mix=4*w*(1-w);const nodeU=(m.x>NB[0]&&m.x<NB[1])?8:0;
    return Object.assign({},base,{km:k,line,hwLag:ef.hw.lag,lwLag:ef.lw.lag,hwLvl:x=>ef.hw.a+ef.hw.b*x,lwLvl:x=>{const v=ef.lw.a+ef.lw.b*x;return base.trunc?Math.max(base.nodeB.floor||-9,v):v;},
      hwU:(m.side?base.hwU:U0[0])+18*mix+nodeU,lwU:(m.side?base.lwU:U0[1])+25*mix+nodeU,beyond:m.side?base.beyond:false,generic:m.side?base.generic:false,
      est:m.side?true:(!!TE.est||(nodeU>0&&w>0.05&&w<0.95)),twoEnt:true,fed:{n:w,s:1-w,x:m.x}});}
  function predictAt(km,t0,t1,opts){opts=opts||{};const line=R.NBY[opts.line]?opts.line:'M';if(!inBlend(km,line))return pa0(km,t0,t1,opts);
    const cal0=calAt(km,opts);const cal=R.applyCorr(cal0,opts.corr);const hoff=opts.hoff||0;
    const dH=(cal.hwLag-cal0.hwLag)/60,dL=(cal.lwLag-cal0.lwLag)/60,dLv=cal.lwLvl(1)-cal0.lwLvl(1),dHv=cal.hwLvl(1)-cal0.hwLvl(1);
    const r=blendSide(Math.max(0,Math.min(R.lineMax(line),km)),line,t0,t1,hoff);
    let ext=r.ext.map(e=>e.hi?{t:e.t+dH,h:e.h+dHv,hi:true,u:cal.hwU}:{t:e.t+dL,h:e.h+dLv,hi:false,u:cal.lwU});
    if(TE.floor){const fl=TE.floor.h-1.5*Math.abs(km-TE.floor.km)/TE.floor.span;for(let i=0;i<ext.length;i++){const e=ext[i];if(e.hi)continue;const nb=[ext[i-1],ext[i+1]].filter(x=>x&&x.hi);
      const cap=nb.length?Math.min(...nb.map(x=>x.h))-0.05:9;if(e.h<fl)e.h=Math.max(e.h,Math.min(fl,cap));}}
    if(cal.trunc){for(let i=0;i<ext.length;i++){const e=ext[i];if(e.hi){const nb=[ext[i-1],ext[i+1]].filter(x=>x&&!x.hi);const fl=nb.length?Math.max(...nb.map(x=>x.h)):-9;e.rise=e.h-fl;if(e.h<fl+0.05)e.weak=true;}}}
    const clean=[];for(const e of ext){const l=clean[clean.length-1];if(l&&l.hi===e.hi){if((e.hi&&e.h>l.h)||(!e.hi&&e.h<l.h))clean[clean.length-1]=e;}else clean.push(e);}
    const curve=t=>{let i=0;while(i<clean.length-2&&clean[i+1].t<t)i++;const a=clean[i],b=clean[i+1];if(!a||!b||t<a.t||t>b.t)return null;const f=(t-a.t)/(b.t-a.t);return a.h+(b.h-a.h)*(1-Math.cos(Math.PI*f))/2;};
    return{cal,ext:clean,curve,inWin:clean.filter(e=>e.t>=t0&&e.t<t1)};}
  function runInStarts(km,h0,h1,opts){const P=predictAt(km,h0,h1,opts);const tr=P.cal.trunc;
    return P.ext.filter((e,i)=>!e.hi&&e.t>=h0-6&&e.t<=h1+6&&!(tr&&P.ext[i+1]&&P.ext[i+1].weak)).map(e=>({t:e.t,u:e.u,kind:tr?'rise':'low'}));}
  /* "Fed from" for UI: weights at a spot */
  function fedFrom(km,line){const m=mainX(km,line||'M');if(!m)return PRIM||!PREV.fedFrom?null:PREV.fedFrom(km,line);const w=wN(m.x);const r={n:w,s:1-w,x:m.x,side:m.side,node:TE.node};if(!PRIM)r.nm=NM;return r;}
  /* km labels both ways: from the south entrance (model chainage) and from the Caloundra bar */
  function kmBoth(km,line){const m=mainX(km,line||'M');if(!m||m.side)return PRIM||!PREV.kmBoth||m?null:PREV.kmBoth(km,line);return{s:km,n:Math.max(0,TE.L-km)+(TE.nOff||0)};}
  /* display names (defaults = Pumicestone) */
  const NM={line:PL,sName:TE.sName||'Bribie bridge',nName:TE.nName||'Caloundra bar',sWord:TE.sWord||'south',nWord:TE.nWord||'north',sTide:TE.sTide||'Scarborough tide',nTide:TE.nTide||'Mooloolaba tide',sAb:TE.sAb||'S',nAb:TE.nAb||'N',gradeCap:TE.gradeCap||null,
    gNote:TE.gNote||'Gauges north of the node are compared with the blended model.',L:TE.L,nOff:TE.nOff||0,node:TE.node,near:TE.nearKm||3};
  if(!PRIM)return Object.assign(R,{calAt,predictAt,runInStarts,fedFrom,kmBoth,TWOS:R.TWOS.concat([NM])});
  return Object.assign(R,{calAt,predictAt,runInStarts,fedFrom,kmBoth,TWO:TE,TWONM:NM,northPort:NP,TWOS:[NM],passNM:line=>R.TWOS.find(N=>N.line===line)||null});}
FT.makeSystemBT=makeSystemBT;
})();
