// Replay the gauge archive through the built Baffle model with / without the live adjustments.
// usage: node adj_validate.mjs [built index.html] [data dir]
// Variants: none | hindcast (causal hourly series: what the app knew at each time) | forecast leave-out (issue every 6 h,
// only data up to the issue time, extremes 0-48 h ahead, decayed adjustment) | surge-only | fresh-only.
import fs from 'fs';import vm from 'vm';
const HTML=process.argv[2]||'/workspace/fishing-site/index.html',DATA=process.argv[3]||'/workspace/fishing-site/data';
const html=fs.readFileSync(HTML,'utf8');const scr=id=>{const m=new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)</script>').exec(html);if(!m)throw new Error('no '+id);return m[1];};
const ctx={console,Math,JSON,Date,setInterval:null};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
for(const id of ['bt-data','bt-core','bt-adj','bt-sides'])vm.runInContext(scr(id),ctx);
const B=ctx.BT,ADJ=ctx.FTADJ;const G=JSON.parse(fs.readFileSync(DATA+'/gauges.json','utf8'));const J=JSON.parse(fs.readFileSync(DATA+'/baffle_adj.json','utf8'));
const iS=J.cols.indexOf('surge'),iF=J.cols.indexOf('F');
function trunc(J,tm){const S=J.series.filter(r=>r[0]<=tm);const ls=[...S].reverse().find(r=>r[iS]!=null),lf=[...S].reverse().find(r=>r[iF]!=null);
  return Object.assign({},J,{series:S,live:Object.assign({},J.live,{surge:ls?ls[iS]:0,surge_t:ls?ls[0]:null,F:lf?lf[iF]:0,F_t:lf?lf[0]:null})});}
function zeroCol(J,i){return Object.assign({},J,{series:J.series.map(r=>{const x=r.slice();x[i]=0;return x;}),live:Object.assign({},J.live,i===iS?{surge:0}:{F:0})});}
const GA={essendean:[35.25,'B'],hillsrd:[25.24,'E']};
function errs(gk,adjFor){const [km,line]=GA[gk];const S=G.series[gk];const s0=S[0][0],s1=S[S.length-1][0];const ev=G.events[gk];const out={HW:[],LW:[],stand:{ok:0,n:0},high:{ok:0,n:0}};
  // predictions per 6-h block so the forecast variant can use a different adjustment per issue time
  for(let h=Math.floor(s0/60/6)*6;h<s1/60;h+=6){const adj=adjFor(h);const P=B.predictAt(km,h-30,h+36,{line,adj});
    for(const e of P.ext){if(!e.src||e.t<h||e.t>=h+6)continue;const t=e.t*60;if(t<s0+60||t>s1-60)continue;const k=e.hi?'HW':'LW';
      const o=ev.find(x=>x.k===k&&Math.abs(x.bt-e.src.t*60)<90);
      if(e.hi){if(e.stand){out.stand.n++;if(!o)out.stand.ok++;continue;}out.high.n++;if(o)out.high.ok++;}
      if(o&&!e.weak)out[k].push(o.v-e.h);}}
  return out;}
const rms=a=>a.length?Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length):NaN,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const full=ADJ.make(J),sOnly=ADJ.make(zeroCol(J,iF)),fOnly=ADJ.make(zeroCol(J,iS));
const fc=lead=>h=>ADJ.make(trunc(J,(h-lead)*60));/* issued `lead` h before the block: data up to then only */
const V={'none':()=>null,'hindcast (causal series)':()=>full,'surge only':()=>sOnly,'fresh only':()=>fOnly,'forecast, issued 0-6 h before':fc(0),'forecast, issued 24-30 h before':fc(24),'forecast, issued 42-48 h before':fc(42)};
const res={};for(const gk of Object.keys(GA)){res[gk]={};for(const [n,f] of Object.entries(V)){const r=errs(gk,f);res[gk][n]=r;}}
for(const gk of Object.keys(GA)){console.log('\n'+gk+'  (obs − model, m; n highs / lows)');
  for(const [n,r] of Object.entries(res[gk]))console.log(`  ${n.padEnd(32)} HW RMSE ${rms(r.HW).toFixed(3)} bias ${mean(r.HW).toFixed(3)} (n ${r.HW.length}) | LW RMSE ${rms(r.LW).toFixed(3)} bias ${mean(r.LW).toFixed(3)} (n ${r.LW.length}) | highs seen ${r.high.ok}/${r.high.n}, stands matched ${r.stand.ok}/${r.stand.n}`);}
fs.writeFileSync('/tmp/adj_validate.json',JSON.stringify(Object.fromEntries(Object.entries(res).map(([g,v])=>[g,Object.fromEntries(Object.entries(v).map(([n,r])=>[n,{HW:rms(r.HW),LW:rms(r.LW),nHW:r.HW.length,nLW:r.LW.length,stand:r.stand,high:r.high}]))]))));
