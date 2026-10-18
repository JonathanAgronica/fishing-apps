// Port tide height (m, port datum) at Sentinel-2 scene times, from the app's own model (BT.portH / BT.bundH).
// usage: node tide_at.mjs <work dir> [cluster ids...]   (reads/writes <work>/<cluster>/scenes.json, adds "h")
import puppeteer from 'puppeteer-core';import fs from 'fs';
const W=process.argv[2],only=process.argv.slice(3);const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const C=JSON.parse(fs.readFileSync(W+'/clusters.json'));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const c of C){if(only.length&&!only.includes(c.id))continue;const f=`${W}/${c.id}/scenes.json`;if(!fs.existsSync(f)){console.log(c.id,'no scenes');continue;}
  const L=JSON.parse(fs.readFileSync(f));const sid=c.systems[0];const p=await b.newPage();
  await p.goto(BASE+'?sys='+sid+'#baffle',{waitUntil:'networkidle0',timeout:90000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
  const H=await p.evaluate(ts=>{const B=window.BT,fn=B.portH||B.bundH;return ts.map(t=>{const d=new Date(Date.parse(t)+10*3600e3);return fn(B.dateToH(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes()+d.getUTCSeconds()/60));});},L.map(x=>x.dt));
  L.forEach((x,i)=>x.h=H[i]);fs.writeFileSync(f,JSON.stringify(L));await p.close();
  const hs=H.slice().sort((a,b)=>a-b);console.log(c.id,sid,L.length,'scenes; port h min/p40/max',hs[0].toFixed(2),hs[Math.floor(hs.length*0.4)].toFixed(2),hs[hs.length-1].toFixed(2));}
await b.close();
