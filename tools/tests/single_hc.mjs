import fs from 'fs';import vm from 'vm';
const load=f=>{const h=fs.readFileSync(f,'utf8');const d=h.split('<script id="data">')[1].split('</script>')[0];const c=h.split('<script id="core">')[1].split('</script>')[0];const g={console};g.window=g;vm.createContext(g);vm.runInContext(d+'\n'+c,g);return g.BT;};
const OLD=load('/workspace/baffle-tides/index.pre-single.html'),NEW=load('/workspace/baffle-tides/index.html');
const G=JSON.parse(fs.readFileSync('/workspace/fishing-site/data/gauges.json'));
const obs=k=>G.events[k].filter(e=>e.k==='HW').map(e=>e.t/60);
const fmt=(B,h)=>B.fmtDT(h);
for(const [k,km,o] of [['essendean',35.25,{}],['hillsrd',25.24,{}]]){
  const ser=G.series[k];const s0=ser[0][0]/60,s1=ser[ser.length-1][0]/60;const O=obs(k);
  console.log('\n== '+k+' km '+km+' obs window',OLD.fmtDT(s0),'→',OLD.fmtDT(s1));
  for(const [nm,B] of [['before',OLD],['after',NEW]]){const P=B.predictAt(km,s0,s1,o);const days={};
    for(const e of P.ext.filter(e=>e.hi&&e.t>=s0+2&&e.t<=s1-2)){const d=B.dayStr(e.t);(days[d]=days[d]||{p:0,w:0,o:0,ok:0,bad:0});
      const seen=O.some(t=>Math.abs(t-e.t)<3);if(e.weak)days[d].w++;else days[d].p++;if(!!e.weak!==!seen)days[d].bad++;else days[d].ok++;}
    for(const t of O){const d=B.dayStr(t);if(days[d])days[d].o++;}
    let tot=0,ok=0;const row=Object.keys(days).sort().map(d=>{const x=days[d];tot+=x.ok+x.bad;ok+=x.ok;return `${d.slice(5)} pred ${x.p}${x.w?'(+'+x.w+' stand)':''} obs ${x.o}${x.bad?' ✗':''}`;});
    console.log(nm.padEnd(6),ok+'/'+tot+' highs classified right');console.log('  '+row.join(' | '));}
}
