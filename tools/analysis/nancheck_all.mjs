import fs from 'fs';import vm from 'vm';globalThis.window=globalThis;
for(const f of ['new-mj-core.js','new-bt-data.js','new-bt-core.js','new-bt-runin.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'));
const E0=Date.UTC(2025,11,31,14),o={hoff:0,badj:0,corr:[]};
const kms=new Set();for(let k=0;k<=39;k++)kms.add(k);for(const l of BT.LANDMARKS)kms.add(l.km);
let n=0,bad=0,badPts=0;const show={};
for(let ds='2026-10-10';ds<='2027-04-30';ds=MJ.addDays(ds,1))for(const km of kms){const [y,m,d]=ds.split('-').map(Number);
  const h0=BT.dateToH(y,m,d-1),h1=BT.dateToH(y,m,d+8);const P=BT.predictAt(km,h0,h1,o);
  const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi}));const runIn=BT.runInStarts(km,h0,h1,o).map(r=>({t:E0+r.t*3.6e6,u:r.u,kind:r.kind}));
  let mx=0;for(let i=1;i<ext.length;i++)mx=Math.max(mx,Math.abs(ext[i].h-ext[i-1].h));const p=BT.pointAtKm(km);
  const day=MJ.computeDay({dateStr:ds,tz:'Australia/Brisbane',lat:p[0],lng:p[1],tideFn:t=>P.curve((t-E0)/3.6e6),ext,wxFn:null,sstFn:null,weekRange:{max:mx},runIn});
  n++;const np=day.pts.filter(q=>!Number.isFinite(q.score)).length;if(np||!Number.isFinite(day.rating)){bad++;badPts+=np;}
  if((ds==='2026-10-17'&&km===35.25)||(ds==='2026-10-16'&&Math.abs(km-34.05)<0.01))show[ds+'@'+km]={rating:day.rating,windows:day.windows.map(w=>new Date(w.start).toISOString().slice(11,16)+'Z '+w.score),pool:day.pts.filter(q=>q.T&&/pool level/.test(q.T.label)).length};}
console.log(JSON.stringify({spotDays:n,bad,badPts,show},null,1));
