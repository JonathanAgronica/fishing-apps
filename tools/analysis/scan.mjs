// Scan Mac's Baffle Jacks bite score using the live app's exact core code (mj-core, bt-core, bt-runin from build 202610091738).
import fs from 'fs';import vm from 'vm';
globalThis.window=globalThis;
const load=f=>vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
let btc=fs.readFileSync('bt-core.js','utf8');
// memoise Bundaberg extremes (pure function of (t0,t1)) for speed — no change to results
btc=btc.replace('function bundExtremes(t0,t1){','const __bx=new Map();function bundExtremes(t0,t1){const k=t0+":"+t1;let r=__bx.get(k);if(!r){r=bundExtremes_(t0,t1);__bx.set(k,r);}return r.map(e=>({...e}));}\nfunction bundExtremes_(t0,t1){');
vm.runInThisContext(fs.readFileSync('mj-core.js','utf8').replace("rising:false}","rising:false,ri:0}")); /* analysis-only fix: live build returns ri undefined here -> NaN score (bug noted) */load('bt-data.js');vm.runInThisContext(btc);load('bt-runin.js');
const MJ=window.MJ,BT=window.BT;const E0=Date.UTC(2025,11,31,14);const TZ='Australia/Brisbane';
const W={light:0.30,tide:0.40,sol:0.16,moon:0.05,wx:0.09};const clamp=x=>Math.max(0,Math.min(1,x));
const OPTS={hoff:0,badj:0,corr:[]};   // app defaults: no height offset, no benchmark corrections
// weather (only for forecast mode) — replicates the app's run()
let wxFn=null,sstFn=null;
if(process.env.WX){const fc=JSON.parse(fs.readFileSync('fc.json'));const h=fc.hourly,tt=h.time.map(s=>MJ.parseLocalIso(s,TZ));const S=k=>MJ.makeSeries(tt,h[k]);
  const P=S('pressure_msl'),Wd=S('wind_speed_10m'),C=S('cloud_cover'),R=S('precipitation'),RH=S('relative_humidity_2m'),T=S('temperature_2m');
  const codeAt=t=>{const i=Math.round((t-tt[0])/3600e3);return i>=0&&i<tt.length?h.weather_code[i]:null;};
  wxFn=t=>{const p=P(t);if(p==null)return null;const p3=P(t-3*3600e3);let storm=false;for(let k=1;k<=6;k++){const c=codeAt(t+k*3600e3);if(c!=null&&c>=95)storm=true;}
    return{p,dp3:p3!=null?p-p3:null,wind:Wd(t),cloud:C(t),rain:R(t),rh:RH(t),temp:T(t),code:codeAt(t),stormAhead:storm};};
  const mr=JSON.parse(fs.readFileSync('mar.json'));const mt=mr.hourly.time.map(s=>MJ.parseLocalIso(s,TZ));if(mr.hourly.sea_surface_temperature.some(v=>v!=null))sstFn=MJ.makeSeries(mt,mr.hourly.sea_surface_temperature);}
function scoreSpot(dateStr,km){const [y,m,d]=dateStr.split('-').map(Number);const h0=BT.dateToH(y,m,d-1,0,0),h1=BT.dateToH(y,m,d+8,0,0);
  const P=BT.predictAt(km,h0,h1,OPTS);const fn=t=>{const v=P.curve((t-E0)/3.6e6);return v==null?null:v;};
  const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi}));
  const runIn=BT.runInStarts(km,h0,h1,OPTS).map(r=>({t:E0+r.t*3.6e6,u:r.u,kind:r.kind}));
  let weekRange=null;if(ext.length>1){let mx=0;for(let i=1;i<ext.length;i++)mx=Math.max(mx,Math.abs(ext[i].h-ext[i-1].h));weekRange={max:mx};}
  const p=BT.pointAtKm(km);
  const day=MJ.computeDay({dateStr,tz:TZ,lat:p[0],lng:p[1],tideFn:fn,ext,wxFn,sstFn,weekRange,runIn});
  const rangeBonus=(day.range!=null&&weekRange)?clamp((day.range/weekRange.max-0.6)/0.4)*0.04:0;
  let best=null;
  for(const q of day.pts){let raw;if(q.T){raw=W.light*q.L.v+W.tide*(q.T.v+rangeBonus)+W.sol*q.S.v+W.moon*day.mpf+W.wx*q.WX.v+0.06*clamp((q.T.ri-0.7)/0.3)*clamp((q.L.v-0.6)/0.4);}
    else raw=(W.light*q.L.v+W.sol*q.S.v+W.moon*day.mpf+W.wx*q.WX.v)/(1-W.tide);
    const unc=(raw*(0.45+0.55*q.TF.v)-0.25)/0.70*100;
    if(Math.abs(Math.min(100,Math.max(0,unc))-q.score)>0.6)throw new Error('score mismatch '+unc+' '+q.score);
    if(!best||unc>best.unc)best={t:q.t,score:q.score,unc:+unc.toFixed(1),L:q.L.label,Lv:+q.L.v.toFixed(3),T:q.T?q.T.label:null,Tv:q.T?+q.T.v.toFixed(3):null,ri:q.T?+q.T.ri.toFixed(3):0,S:q.S.v>0.05?q.S.label:'',Sv:+q.S.v.toFixed(2),TF:+q.TF.v.toFixed(2),sst:q.sst,WX:+q.WX.v.toFixed(2),wxn:q.WX.notes};}
  const n100=day.pts.filter(q=>q.score>=100).length;const nanPts=day.pts.filter(q=>q.T&&/No tide reaching|Slack high/.test(q.T.label)).length;
  return{date:dateStr,km,rating:day.rating,mpf:+day.mpf.toFixed(2),phase:MJ.phaseName(day.illum.phase),illum:+day.illum.fraction.toFixed(2),range:day.range,rb:+rangeBonus.toFixed(3),
    runIns:day.runIns.map(r=>({t:r.t,u:Math.round(r.u),k:r.kind})),best,n100,nanPts,wins:day.windows.map(w=>({s:w.start,e:w.end,sc:w.score}))};}
const kms=new Set();for(let k=0;k<=39;k++)kms.add(k);for(const l of BT.LANDMARKS)kms.add(+l.km.toFixed(2));
const K=[...kms].sort((a,b)=>a-b);
const d0=process.env.D0||'2026-10-10',d1=process.env.D1||'2027-04-30';
const out=fs.createWriteStream(process.env.OUT||'scan.jsonl');let ds=d0,n=0;const tS=Date.now();
while(ds<=d1){for(const km of K){out.write(JSON.stringify(scoreSpot(ds,km))+'\n');n++;}
  if(ds.endsWith('-01')||ds===d0)console.error(ds,n,((Date.now()-tS)/1000).toFixed(0)+'s');ds=MJ.addDays(ds,1);}
out.end();console.error('done',n);
