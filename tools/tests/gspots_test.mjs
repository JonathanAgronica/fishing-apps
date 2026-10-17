import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/gspots/';
import fs from 'fs';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.setViewport({width:420,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function open(sys){await p.goto(BASE+'?sys='+sys+'&r='+Date.now()+'#gauges',{waitUntil:'domcontentloaded'});await p.waitForSelector('body[data-sys-ready="'+sys+'"]',{timeout:60000});
  await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:60000});await sleep(800);}
async function info(){return p.evaluate(()=>{const svg=document.getElementById('gChart');const g=window.__FT_GAUGES();const nowM=(Date.now()-Date.UTC(2025,11,31,14))/60000;
  const L=FT.gSpots.list();return{sel:L.map(r=>[r.name,r.km,r.col,r.custom?'custom':r.builtin?'lm':'km']),
   dashed:[...svg.querySelectorAll('path[stroke-dasharray="6 3"]')].map(x=>x.getAttribute('stroke')).filter(c=>L.some(r=>r.col===c)).length,
   runIn:[...svg.querySelectorAll('path')].filter(x=>/l9,6l-9,6z/.test(x.getAttribute('d')||'')).length,
   hollowLag:[...svg.querySelectorAll('circle[fill="#0f2427"]')].length,
   cards:[...document.querySelectorAll('.gsp-card')].map(c=>c.innerText.replace(/\s+/g,' ')),
   viewEndH:+((g.view[1]-nowM)/60).toFixed(1),
   keys:Object.keys(localStorage).filter(k=>/gspots|mbj_spots/.test(k)),
   summary:document.querySelector('#gSpots summary').innerText};});}
async function tap(frac){const bb=await (await p.$('#gChart')).boundingBox();await p.evaluate(()=>document.getElementById('gChart').scrollIntoView({block:'start'}));await sleep(200);
  const bb2=await (await p.$('#gChart')).boundingBox();await p.touchscreen.tap(bb2.x+bb2.width*frac,bb2.y+120);await sleep(300);return p.evaluate(()=>document.getElementById('gTip').innerText);}
const clickSp=async txt=>p.evaluate(t=>{const b=[...document.querySelectorAll('#gSpots [data-sp]')].find(x=>x.textContent.includes(t));if(!b)return 'missing '+t;b.click();return 'ok';},txt);
const addKm=async(km,line)=>p.evaluate((km,line)=>{document.querySelector('#gSpots details').open=true;document.getElementById('gSpKm').value=km;if(line&&document.getElementById('gSpLine'))document.getElementById('gSpLine').value=line;document.getElementById('gSpAdd').click();return document.getElementById('gSpMsg').textContent;},km,line);
// ---- Baffle with TEST-ONLY spots in this throwaway browser profile
await open('baffle');
console.log('add spots',await p.evaluate(()=>{const a=FT.spots.add(Object.assign({name:'Private spot 8'},(([la,ln])=>({lat:la,lng:ln}))(BT.pointAtKm(19.97))));const c=FT.spots.add(Object.assign({name:"Private spot 4",color:'#ff5d8f'},(([la,ln])=>({lat:la,lng:ln}))(BT.pointAtKm(33.55))));return [a.km,c.km,a.color,c.color];}));
await p.evaluate(()=>document.querySelector('#gSpots details').open=true);
console.log(await clickSp('Private spot 8'),await clickSp("Hugh"),await clickSp('Winfield'));
console.log('addKm',JSON.stringify(await addKm(10)));
await p.evaluate(()=>{document.getElementById('gSpBand').click();});await sleep(500);
const I1=await info();console.log('baffle',JSON.stringify(I1,null,1));
console.log('tip',await tap(0.80));
await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:SH+'baffle-spots.png',fullPage:true});
// persistence
await open('baffle');const I2=await info();console.log('baffle reload sel',JSON.stringify(I2.sel),'viewEndH',I2.viewEndH);
// 2d range
await p.evaluate(()=>document.querySelector('.gbar [data-r="2"]').click());await sleep(300);
console.log('2d viewEnd',(await info()).viewEndH);
await p.evaluate(()=>{document.getElementById('gTip').style.display='none';document.getElementById('gCur').innerHTML='';});const chart=await p.$('#gChart');await p.evaluate(()=>document.getElementById('gChart').scrollIntoView());await chart.screenshot({path:SH+'baffle-spots-2d-chart.png'});
// ---- Brisbane: landmark + km on a tributary
await open('brisbane-river');
await p.evaluate(()=>document.querySelector('#gSpots details').open=true);
const lm=await p.evaluate(()=>[...document.querySelectorAll('#gSpots [data-sp]')].slice(0,40).map(x=>x.textContent.trim()));console.log('brisbane landmarks',lm.length,lm.slice(0,8));
console.log(await p.evaluate(()=>{const b=[...document.querySelectorAll('#gSpots [data-sp]')].find(x=>/Oxley|Indooroopilly|Breakfast|Kangaroo|Hamilton/.test(x.textContent))||document.querySelector('#gSpots [data-sp]');b.click();return b.textContent;}));
console.log('addKm',JSON.stringify(await addKm(55)));
const I3=await info();console.log('brisbane',JSON.stringify(I3,null,1));
console.log('tip',await tap(0.85));
await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:SH+'brisbane-spots.png',fullPage:true});
// ---- C-grade, no gauges
await open('littabella-creek');await p.evaluate(()=>document.querySelector('#gSpots details').open=true);
console.log('addKm',JSON.stringify(await addKm(3)));const I4=await info();console.log('littabella',JSON.stringify(I4));
await p.screenshot({path:SH+'littabella-spots.png',fullPage:true});
// baffle selection unaffected by other systems
await open('baffle');console.log('baffle sel after others',JSON.stringify((await info()).sel));
console.log('ERRORS',errs);await b.close();
