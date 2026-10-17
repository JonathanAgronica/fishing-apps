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
  return Object.assign({},B0,{generic:true,SYS:S,bundH:portH,bundExtremes:portExtremes,portH,portExtremes,officialHiLo:()=>[],NODES,calAt,predictAt,runInStarts,
    snap,pointAtKm,pointOnLine,lineName,sameReach,LINES,LANDMARKS,MAXKM,applyCorr,RISE:null,NBY,lineMax,REFKM,REFNAME,DEFKM});}
FT.makeSystemBT=makeSystemBT;
})();
