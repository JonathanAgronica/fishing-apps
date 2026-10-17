/* ===== Baffle Ck side creeks + Euleilah Ck upstream extension =====
   Side creeks are channels like Euleilah Ck: their km is counted from the Baffle mouth through the junction
   (km = junction km + distance up the side creek), so every tab keeps one km scale; labels show "Mosquito Ck 2 km".
   Tides on a side creek (and on Euleilah above its old line end, 31.44 km) are an ESTIMATE: the model at the junction
   (or at 31.44 km on Euleilah) without single-high suppression, then a generic upstream lag/attenuation taken from the
   Baffle main channel (Winfield → Hills Rd: HW +5.2 min/km, LW +7.4 min/km), highs −2.5 cm/km, lows +5 cm/km, wide ±.
   Baffle main channel and Euleilah ≤ 31.44 km are untouched (the original functions are called unchanged). */
(function(){'use strict';const BT=window.BT,D=window.BAFFLE_DATA;if(!BT||BT.generic||!D||!D.sides||BT.SIDES)return;
const RAD=Math.PI/180,EJ=D.euleilahJunctionKm,EUCAL=D.euCalEnd;
const hav=(a,b)=>{const la1=a[0]*RAD,la2=b[0]*RAD,dl=(b[0]-a[0])*RAD,dn=(b[1]-a[1])*RAD;const x=Math.sin(dl/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dn/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(x));};
const cum=L=>{const c=[0];for(let i=1;i<L.length;i++)c.push(c[i-1]+hav(L[i-1],L[i]));return c;};
const SIDES=D.sides.map(s=>{const C=cum(s.pts);return Object.assign({},s,{C,len:C[C.length-1],max:+(s.jk+C[C.length-1]).toFixed(2)});});
const BY={};SIDES.forEach(s=>BY[s.id]=s);
const EUC=cum(D.euleilah),EUMAX=+(EJ+EUC[EUC.length-1]).toFixed(2);
const R={hw:5.2,lw:7.4,hiDrop:0.025,loRise:0.05,u0:15,hwU:8,lwU:12};
function baseOf(km,line){if(line==='E'&&km>EUCAL+1e-6)return{bkm:EUCAL,d:km-EUCAL};const s=BY[line];if(s)return{bkm:s.jk,d:Math.max(0,Math.min(s.len,km-s.jk))};return null;}
const P0=BT.predictAt,RI0=BT.runInStarts,SN0=BT.snap;
BT.predictAt=function(km,t0,t1,opts){opts=opts||{};const b=baseOf(km,opts.line);if(!b)return P0(km,t0,t1,opts);
  const d=b.d,o=Object.assign({},opts,{line:'E'});/* line 'E' = model without single-high suppression (no evidence on side creeks) */
  const P=P0(b.bkm,t0-2,t1,o),lH=d*R.hw/60,lL=d*R.lw/60;
  const ext=P.ext.map(e=>Object.assign({},e,e.hi?{t:e.t+lH,h:e.h-d*R.hiDrop,u:(e.u||0)+R.u0+d*R.hwU}:{t:e.t+lL,h:e.h+d*R.loRise,u:(e.u||0)+R.u0+d*R.lwU}));
  for(let i=0;i<ext.length;i++){const e=ext[i];if(e.hi)continue;const hs=[ext[i-1],ext[i+1]].filter(x=>x&&x.hi&&!x.weak);if(hs.length)e.h=Math.min(e.h,Math.min(...hs.map(x=>x.h))-0.1);}
  const K=ext.filter(e=>!e.weak);
  const curve=t=>{let i=0;while(i<K.length-2&&K[i+1].t<t)i++;const a=K[i],c=K[i+1];if(!a||!c||t<a.t||t>c.t)return null;const f=(t-a.t)/(c.t-a.t);return a.h+(c.h-a.h)*(1-Math.cos(Math.PI*f))/2;};
  const c0=P.cal,cal=Object.assign({},c0,{km,est:true,side:{line:opts.line,d,base:b.bkm},line:opts.line,supThr:0,hwLag:c0.hwLag+d*R.hw,lwLag:c0.lwLag+d*R.lw,
    hwU:c0.hwU+R.u0+d*R.hwU,lwU:c0.lwU+R.u0+d*R.lwU,hwLvl:H=>c0.hwLvl(H)-d*R.hiDrop,lwLvl:L=>c0.lwLvl(L)+d*R.loRise});
  return{cal,ext,curve,inWin:ext.filter(e=>e.t>=t0&&e.t<t1)};};
BT.runInStarts=function(km,h0,h1,opts){opts=opts||{};const b=baseOf(km,opts.line);if(!b)return RI0(km,h0,h1,opts);
  const d=b.d,P=BT.predictAt(km,h0,h1,opts);
  return RI0(b.bkm,h0-2,h1,Object.assign({},opts,{line:'E'})).map(r=>({t:r.t+d*R.lw/60,u:r.u+R.u0+d*R.lwU,kind:r.kind}))
    .filter(r=>{if(r.t<h0-6||r.t>h1+6)return false;const nh=P.ext.find(e=>e.hi&&e.t>r.t&&e.t-r.t<7);return!(nh&&nh.weak);});};
function proj(L,C,lat,lon){const kx=111.32*Math.cos(lat*RAD),ky=110.54;let best={d:1e9};
  for(let i=0;i<L.length-1;i++){const ax=(L[i][1]-lon)*kx,ay=(L[i][0]-lat)*ky,bx=(L[i+1][1]-lon)*kx,by=(L[i+1][0]-lat)*ky;const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));
    const d=Math.hypot(ax+t*dx,ay+t*dy);if(d<best.d)best={d,s:C[i]+t*(C[i+1]-C[i]),lat:L[i][0]+t*(L[i+1][0]-L[i][0]),lon:L[i][1]+t*(L[i+1][1]-L[i][1])};}return best;}
BT.snap=function(lat,lon){const m=SN0(lat,lon);let b=null;for(const s of SIDES){const p=proj(s.pts,s.C,lat,lon);if(!b||p.d<b.d){p.sd=s;b=p;}}
  if(b&&b.s>0.05&&b.d<m.offKm-0.03)return{km:+(b.sd.jk+b.s).toFixed(3),offKm:b.d,line:b.sd.name,lineId:b.sd.id,lat:b.lat,lon:b.lon,alongKm:b.s};return m;};
BT.pointOnSide=function(km,id){const s=BY[id];if(!s)return null;const a=Math.max(0,Math.min(s.len,km-s.jk));const C=s.C,L=s.pts;
  for(let i=1;i<C.length;i++)if(C[i]>=a){const f=(a-C[i-1])/Math.max(1e-9,C[i]-C[i-1]);return[L[i-1][0]+f*(L[i][0]-L[i-1][0]),L[i-1][1]+f*(L[i][1]-L[i-1][1])];}return L[L.length-1].slice();};
BT.SIDES=SIDES;BT.sideOf=id=>BY[id]||null;BT.EUMAX=EUMAX;BT.EUCAL=EUCAL;
BT.lineMaxKm=id=>id==='E'?EUMAX:BY[id]?BY[id].max:BT.MAXKM;
BT.lineMinKm=id=>id==='E'?EJ:BY[id]?BY[id].jk:0;
BT.isSide=id=>!!BY[id];
BT.parentOf=id=>id==='E'?'B':BY[id]?BY[id].parent:null;
BT.bLineName=(id,short)=>id==='E'?(short?'Euleilah':'Euleilah Ck'):BY[id]?(short?BY[id].short.replace(/ Ck$/,''):BY[id].short):(short?'Baffle':'Baffle Ck');
BT.alongKm=(km,id)=>id==='E'?km-EJ:BY[id]?km-BY[id].jk:km;
BT.isEstKm=(km,id)=>!!BY[id]||(id==='E'&&km>EUCAL+1e-6);
BT.SIDE_RATES=R;
/* landmarks: appended (existing built-in ids stay b0…b16) */
const L=BT.LANDMARKS,has=n=>L.some(l=>l.name===n);
for(const s of SIDES){const jn=s.short.replace(/ Ck$/,' Creek')+' junction';
  if(!has(jn))L.push({name:jn,km:s.jk,line:s.parent,note:s.parent==='E'?'on Euleilah Ck, '+(s.jk-EJ).toFixed(1)+' km above its junction':''});
  else{const l=L.find(x=>x.name===jn);l.line=l.line||s.parent;}
  L.push({name:s.short+' tidal limit (est.)',km:s.max,line:s.id,est:true,note:s.len.toFixed(1)+' km up '+s.short+' — DEM/OSM estimate, benchmark me'});}
L.push({name:'Euleilah Ck tidal limit (est.)',km:EUMAX,line:'E',est:true,note:(EUMAX-EJ).toFixed(1)+' km up Euleilah — DEM/OSM estimate, benchmark me'});
const hr=L.find(l=>/Hills Rd gauge/.test(l.name));if(hr)hr.line='E';
})();
