import fs from 'fs';import vm from 'vm';globalThis.window=globalThis;
for(const f of ['mj-core.js','bt-data.js','bt-core.js','bt-runin.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'));
const E0=Date.UTC(2025,11,31,14),km=35.25,ds=process.argv[2];const [y,m,d]=ds.split('-').map(Number);
const h0=BT.dateToH(y,m,d-1),h1=BT.dateToH(y,m,d+8),o={hoff:0,badj:0,corr:[]};const P=BT.predictAt(km,h0,h1,o);
const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi}));const runIn=BT.runInStarts(km,h0,h1,o).map(r=>({t:E0+r.t*3.6e6,u:r.u,kind:r.kind}));
let mx=0;for(let i=1;i<ext.length;i++)mx=Math.max(mx,Math.abs(ext[i].h-ext[i-1].h));const p=BT.pointAtKm(km);
const day=MJ.computeDay({dateStr:ds,tz:'Australia/Brisbane',lat:p[0],lng:p[1],tideFn:t=>P.curve((t-E0)/3.6e6),ext,wxFn:null,sstFn:null,weekRange:{max:mx},runIn});
console.log('rating',day.rating,'NaN pts',day.pts.filter(q=>Number.isNaN(q.score)).length,'windows',day.windows.length);
