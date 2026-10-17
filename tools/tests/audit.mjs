import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const OUT=process.env.OUT;
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await (await b.createBrowserContext()).newPage();
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=baffle#bite',{waitUntil:'networkidle0'});await p.evaluate(()=>{localStorage.clear();});await p.reload({waitUntil:'networkidle0'});
await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
await p.evaluate(()=>{const S=FT.spots;[['A',4,'ri','s'],['B',9,'ro','d']].forEach(([n,k,t,d])=>{const q=BT.pointAtKm(k);S.add({name:'Spot '+n,lat:q[0],lng:q[1],type:t,depth:d});});});
const sl=ms=>new Promise(r=>setTimeout(r,ms));const info={};
for(const t of ['bite','baffle','gauges','cal','map','log']){await p.evaluate(t=>FT.showTab(t),t);await sl(t==='cal'?6000:2500);
  info[t]=await p.evaluate(t=>{const T=document.getElementById('tab-'+t);return{h:Math.round(document.documentElement.scrollHeight),heads:[...T.querySelectorAll('h2,h3,summary,select,button')].filter(e=>e.offsetParent).map(e=>e.tagName[0]+':'+(e.innerText||e.id).trim().slice(0,40).replace(/\n/g,' '))};},t);
  await p.screenshot({path:`${OUT}/${t}.png`,fullPage:true});}
await p.evaluate(()=>FT.showTab('bite'));await p.evaluate(()=>FT.planDay(document.getElementById('mj-date').value));await p.waitForFunction(()=>document.body.dataset.planReady,{timeout:240000});await sl(500);
await p.screenshot({path:`${OUT}/plan.png`,fullPage:true});
console.log(JSON.stringify(info,null,0));await b.close();
