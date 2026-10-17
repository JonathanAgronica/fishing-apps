import puppeteer from 'puppeteer-core';import fs from 'fs';
const NEW=process.env.NEW||'http://localhost:18080/test-apps/',OLD=process.env.OLD||'http://localhost:18080/before-apps/';
const SH=process.env.SHOTS||'/workspace/multisys/shots/weather/';fs.mkdirSync(SH,{recursive:true});
const NEWH='pressure_msl,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,relative_humidity_2m,temperature_2m,weather_code,cape,lifted_index';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const CACHE=new Map();const R={};let FAIL=false;
async function page(){const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|tile|ERR_/i.test(m.text()))p.errs.push(m.text());});
  await p.setRequestInterception(true);
  p.on('request',async r=>{const u=r.url();if(!/open-meteo\.com\/v1\/(forecast|marine)/.test(u)||/geocoding/.test(u))return r.continue();
    if(FAIL)return r.abort('internetdisconnected');let nu=u;if(/\/v1\/forecast/.test(u))nu=u.replace(/hourly=[^&]*/,'hourly='+NEWH);
    try{if(!CACHE.has(nu)){const res=await fetch(nu);CACHE.set(nu,await res.text());}r.respond({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:CACHE.get(nu)});}catch(e){r.abort();}});
  await p.setViewport({width:420,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});return p;}
const ready=async p=>{await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});await sleep(300);};
async function week(p){return p.evaluate(()=>{const S=window.__MJ_STATE;const f=t=>new Date(t+36e6).toISOString().slice(11,16);
  return S.days.map(d=>{const w=d.windows.slice().sort((a,b)=>b.score-a.score)[0];return{date:d.dateStr,rating:d.rating,best:w?f(w.start)+'–'+f(w.end)+' '+w.score:'',
    notes:w?w.peak.WX.notes:[],wx:d.wxDay?{dz:d.wxDay.drizzleH,storm:d.wxDay.storm&&{v:+d.wxDay.storm.v.toFixed(2),t:f(d.wxDay.storm.t),cape:d.wxDay.storm.cape},lt:d.wxDay.lightning.map(f),heavy:d.wxDay.heavyH,fresh:d.wxDay.fresh&&d.wxDay.fresh.note}:null,
    badge:(document.querySelectorAll('#mj-days .day')[S.days.indexOf(d)]||{}).innerText};});});}
async function privspot(base,shot){const p=await page();await p.goto(base+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
  await p.evaluate(()=>{const [la,ln]=BT.pointAtKm(19.97);const l=FT.spots.add({name:'Private spot 8',lat:la,lng:ln,type:'ri'});document.body.dataset.biteReady='';FT.biteSetLoc({name:'Private spot 8 — Baffle Ck',lat:l.lat,lng:l.lng,tz:'Australia/Brisbane',baffleKm:l.km,spotId:l.id});});
  await ready(p);await p.evaluate(()=>FT.biteSetDate('2026-10-10'));await sleep(500);await ready(p);
  const W=await week(p);const st=await p.evaluate(()=>window.__MJ_STATE.spotType);
  if(shot){await p.evaluate(()=>document.getElementById('mj-stats').scrollIntoView());await p.screenshot({path:SH+shot+'-stats.png'});
    await p.evaluate(()=>document.getElementById('mj-days').scrollIntoView());await p.screenshot({path:SH+shot+'-week.png'});}
  const e=p.errs;await p.browserContext().close();return{st,W,errs:e};}
async function burnett(base,shot){const p=await page();await p.goto(base+'?sys=burnett-river&r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
  await p.evaluate(()=>{document.body.dataset.biteReady='';const s=document.getElementById('mj-bafSel');s.value=[...s.options].find(o=>/Burnett Heads/.test(o.textContent)).value;s.dispatchEvent(new Event('change'));});
  await ready(p);await p.evaluate(()=>FT.biteSetDate('2026-10-10'));await sleep(500);await ready(p);
  const W=await week(p);const loc=await p.evaluate(()=>document.getElementById('mj-locInfo').innerText.slice(0,70));
  if(shot){await p.evaluate(()=>document.getElementById('mj-days').scrollIntoView());await p.screenshot({path:SH+shot+'-week.png'});}
  const e=p.errs;await p.browserContext().close();return{loc,W,errs:e};}
R.privspotOld=await privspot(OLD);R.privspotNew=await privspot(NEW,'privspot');
R.burnettOld=await burnett(OLD);R.burnettNew=await burnett(NEW,'burnett');
// synthetic drizzle / storm cases (no tide, Private spot 8 position, Mon 12 Oct)
{const p=await page();await p.goto(NEW+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
 R.synth=await p.evaluate(()=>{const ds='2026-10-12',tz='Australia/Brisbane';const t0=MJ.dayStart(ds,tz);const tt=[];for(let i=-24;i<48;i++)tt.push(t0+i*3600e3);
  const H=i=>((i%24)+24)%24;const base=()=>({time:tt,pressure_msl:tt.map(()=>1015),wind_speed_10m:tt.map(()=>10),wind_gusts_10m:tt.map(()=>18),cloud_cover:tt.map(()=>20),precipitation:tt.map(()=>0),precipitation_probability:tt.map(()=>5),
    relative_humidity_2m:tt.map(()=>60),temperature_2m:tt.map(()=>25),weather_code:tt.map(()=>1),cape:tt.map(()=>50),lifted_index:tt.map(()=>3)});
  const [la,ln]=BT.pointAtKm(19.97);const run=h=>MJ.computeDay({dateStr:ds,tz,lat:la,lng:ln,wxFn:MJ.makeWxFn(tt,h)});
  const at=(d,hr)=>{const p=d.pts[hr*4];return{score:p.score,light:+p.L.v.toFixed(2),lightLabel:p.L.label,wx:+p.WX.v.toFixed(2),notes:p.WX.notes};};
  const B=run(base());
  const dz=base();tt.forEach((t,i)=>{const h=H(i-24+24);if(i>=24&&i<48&&h>=8&&h<=12){dz.precipitation[i]=0.4;dz.weather_code[i]=53;dz.cloud_cover[i]=95;dz.relative_humidity_2m[i]=92;}});const D=run(dz);
  const sm=base();tt.forEach((t,i)=>{const h=i-24;if(h>=12&&h<=20){const k=1-Math.abs(h-17)/5;sm.cape[i]=300+1500*k;sm.lifted_index[i]=-4*k;sm.precipitation_probability[i]=Math.round(30+50*k);sm.relative_humidity_2m[i]=80;sm.temperature_2m[i]=29;}
    if(h>=13&&h<=17)sm.pressure_msl[i]=1015-(h-13)*1.0;if(h>17&&h<=20)sm.pressure_msl[i]=1011;if(h===17||h===18){sm.weather_code[i]=95;sm.precipitation[i]=3;}});const S=run(sm);
  const hv=base();tt.forEach((t,i)=>{const h=i-24;if(h>=9&&h<=11){hv.precipitation[i]=14;hv.weather_code[i]=65;hv.wind_speed_10m[i]=38;}});const HV=run(hv);
  const miss=base();delete miss.cape;delete miss.lifted_index;delete miss.precipitation_probability;delete miss.wind_gusts_10m;const M=run(miss);
  const hours=[6,9,10,11,14,15,16,17,18,20];
  return{hours,base:hours.map(h=>B.hourly[h].score),drizzle:hours.map(h=>D.hourly[h].score),storm:hours.map(h=>S.hourly[h].score),heavyWind:hours.map(h=>HV.hourly[h].score),missingFields:hours.map(h=>M.hourly[h].score),
   at10:{base:at(B,10),drizzle:at(D,10)},storm15:at(S,15),storm17:at(S,17),heavy10:at(HV,10),
   wxDay:{drizzle:D.wxDay.drizzleH,storm:S.wxDay.storm&&{v:+S.wxDay.storm.v.toFixed(2),t:new Date(S.wxDay.storm.t+36e6).toISOString().slice(11,16)},lt:S.wxDay.lightning.length,heavy:HV.wxDay.heavyH},
   fresh:{flood:MJ.freshAdj({lvl:'flood',name:'Mimdale',above:0.9,rise24:0.4,at:t0},t0+864e5),floodDay6:MJ.freshAdj({lvl:'flood',name:'Mimdale',above:0.9,rise24:0.4,at:t0},t0+6*864e5),small:MJ.freshAdj({lvl:'fresh',name:'Mimdale',above:0.2,rise24:0.1,at:t0},t0+3600e3)},
   W:MJ.W};});
 // offline: API unreachable -> the cached forecast (same dates) is reused, storm/drizzle still computed
 FAIL=true;await p.evaluate(()=>{document.body.dataset.biteReady='';FT.biteSetDate('2026-10-11');});await ready(p);
 await p.evaluate(()=>{document.body.dataset.biteReady='';FT.biteSetDate('2026-10-10');});await ready(p);
 R.offline=await p.evaluate(()=>({notices:document.getElementById('mj-notices').innerText.slice(0,300),wx:!!window.__MJ_STATE.wxFn,storm:window.__MJ_STATE.days.map(d=>d.wxDay&&d.wxDay.storm?+d.wxDay.storm.v.toFixed(2):0),dz:window.__MJ_STATE.days.map(d=>d.wxDay.drizzleH)}));
 FAIL=false;
 await p.evaluate(()=>{const d=[...document.querySelectorAll('#mj-main details, details')].find(x=>/Weather \(/.test(x.innerText));if(d){d.open=true;d.scrollIntoView();}});await p.screenshot({path:SH+'factor-notes.png'});
 R.synthErrs=p.errs;}
console.log(JSON.stringify(R,null,1));await b.close();
