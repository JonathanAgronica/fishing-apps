import fs from 'fs'; import vm from 'vm';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const data=/<script id="data">([\s\S]*?)<\/script>/.exec(html)[1];const core=/<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
globalThis.window=globalThis;vm.runInThisContext(data);vm.runInThisContext(core);const B=globalThis.BT;
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
// 1. harmonic vs official 2026 HiLo
let dt=[];for(const [m,cm,hi] of BAFFLE_DATA.hilo2026){const t=m/60;const E=B.bundExtremes(t-1.5,t+1.5).filter(e=>e.hi===!!hi);if(!E.length)continue;const e=E.sort((a,b)=>Math.abs(a.t-t)-Math.abs(b.t-t))[0];dt.push([(e.t-t)*60,e.h-cm/100,hi]);}
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
console.log('JS harmonic vs official 2026 hilo: n',dt.length,'time RMS',rms(dt.map(x=>x[0])).toFixed(1),'min; height RMS',rms(dt.map(x=>x[1])).toFixed(3),'m');
ok(rms(dt.map(x=>x[0]))<8,'timing rms');ok(rms(dt.map(x=>x[1]))<0.05,'height rms');
// 2. snapping
const s=B.snap(-24.601073,151.844864);console.log('snap Essendean',s.km.toFixed(2),'km off',(s.offKm*1000).toFixed(0),'m');ok(Math.abs(s.km-35.25)<0.1,'snap ess');
const s2=B.snap(-24.4764,151.8892);console.log('snap Hills Rd',s2.line,s2.km.toFixed(2));ok(Math.abs(s2.km-25.24)<0.3,'snap hills');
// 3. node reproduction
for(const n of B.NODES){const c=B.calAt(n.km);ok(Math.abs(c.hwLag-n.hwLag)<1e-6,'node lag '+n.name);}
// 4. today/tomorrow
const today=B.dayStr(B.nowH());const [y,m,d]=today.split('-').map(Number);
for(const k of [0,1]){const t0=B.dateToH(y,m,d+k,0,0);console.log('\n==',B.fmtDay(t0+12,true));
  const off=B.officialHiLo(t0,t0+24);console.log('  Official MSQ Bundaberg:',off.map(e=>(e.hi?'H ':'L ')+B.fmtT(e.t)+' '+e.h.toFixed(2)+'LAT').join(', '));
  for(const [nm,km] of [['Mouth',0],['Winfield',3.4],['Rocky Point',6.51],['Wartburg',15.9],['Hills Rd (Euleilah)',25.24],['Essendean',35.25]]){const p=B.predictAt(km,t0,t0+24,{});
    console.log('  '+nm.padEnd(20),p.inWin.map(e=>(e.hi?'H ':'L ')+B.fmtT(e.t)+' '+(e.h>=0?'+':'')+e.h.toFixed(2)+(e.weak?' (weak)':'')+' ±'+Math.round(e.u)).join(' | '));}}
// 5. in-sample check vs observed Essendean / Hills peaks (2-9 Oct 2026)
const G=JSON.parse(fs.readFileSync(new URL('./research/gauge_events.json',import.meta.url)));
for(const [g,km] of [['Essendean',35.25],['HillsRd',25.24]]){for(const kind of ['HW','LW']){const R=G[g].filter(r=>r.kind===kind);const dd=[],dh=[];
  for(const r of R){const p=B.predictAt(km,r.mid-8,r.mid+8,{});const c=p.ext.filter(e=>e.hi===(kind==='HW')).sort((a,b)=>Math.abs(a.t-r.mid)-Math.abs(b.t-r.mid))[0];if(!c)continue;dd.push((c.t-r.mid)*60);dh.push(c.h-r.val);}
  console.log(`${g} ${kind}: n=${dd.length} predicted-observed time RMS ${rms(dd).toFixed(0)} min (mean ${(dd.reduce((a,b)=>a+b,0)/dd.length).toFixed(0)}), level RMS ${rms(dh).toFixed(2)} m`);}}
// 6. corrections
const c0=B.calAt(20),c1=B.applyCorr(c0,[{km:20,kind:'HW',d:30}]);ok(Math.abs(c1.hwLag-c0.hwLag-30)<1e-6,'corr');const c2=B.applyCorr(B.calAt(27),[{km:20,kind:'HW',d:30}]);ok(c2.corr.hw===0,'corr fade');
console.log(fail?`\n${fail} FAILURES`:'\nall checks passed');process.exit(fail?1:0);
