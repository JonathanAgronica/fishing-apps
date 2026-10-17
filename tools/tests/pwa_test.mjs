import puppeteer from 'puppeteer-core';
const BASE='http://localhost:8770/fishing-site/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const res={};
for(const path of ['','mangrove-jack/','baffle-tides/']){
  const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(BASE+path,{waitUntil:'networkidle0',timeout:60000});
  if(path)await p.waitForSelector('body[data-ready="1"]',{timeout:60000});
  await p.evaluate(()=>navigator.serviceWorker.ready);await new Promise(r=>setTimeout(r,1500));
  const m=await p.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');const j=await (await fetch(l.href)).json();return {name:j.name,icons:j.icons.length,sw:!!navigator.serviceWorker.controller||!!(await navigator.serviceWorker.getRegistration()),
     wins:(document.querySelector('#windows')||{}).innerText?.slice(0,160),tide:(document.querySelector('#stats')||{}).innerText?.slice(0,120),notices:(document.querySelector('#notices')||{}).innerText||''};});
  // offline reload
  await p.setOfflineMode(true);await p.reload({waitUntil:'domcontentloaded'});await new Promise(r=>setTimeout(r,2500));
  const off=await p.evaluate(()=>({title:document.title,ready:document.body.dataset.ready||null,txt:document.body.innerText.slice(0,80),notices:(document.querySelector('#notices')||{}).innerText?.slice(0,200)||''}));
  await p.setOfflineMode(false);
  if(path)await p.screenshot({path:`/workspace/fishing-site-src/shot-${path.replace('/','')}.png`});
  else await p.screenshot({path:'/workspace/fishing-site-src/shot-landing.png'});
  res[path||'landing']={m,off,errs};await p.close();}
console.log(JSON.stringify(res,null,1));await b.close();
