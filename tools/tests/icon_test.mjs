import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const OUT=process.env.OUT||'/tmp/ic/hdr.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[],bad=[];
p.on('pageerror',e=>errs.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?t='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});
await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
const sw=await p.evaluate(async()=>{const r=await navigator.serviceWorker.ready;await new Promise(s=>setTimeout(s,2500));const ks=await caches.keys();const c=await caches.open(ks.find(k=>/^fishtimes-\d/.test(k)));return {ks,n:(await c.keys()).map(x=>x.url.replace(location.origin,'')).filter(u=>/icon|favicon/.test(u))};});
const man=await p.evaluate(async()=>{const m=await (await fetch(document.querySelector('link[rel=manifest]').href)).json();const base=new URL(document.querySelector('link[rel=manifest]').href);
 const out=[];for(const i of m.icons){const u=new URL(i.src,base);const bl=await (await fetch(u)).blob();const im=await createImageBitmap(bl);out.push([i.src,i.purpose,i.sizes,im.width+'x'+im.height,bl.size]);}
 for(const sel of ['link[rel=apple-touch-icon]','link[rel=icon][sizes="32x32"]','link[rel=icon][sizes="16x16"]','link[rel=icon][sizes=any]']){const u=document.querySelector(sel).href;const bl=await (await fetch(u)).blob();let d='';try{const im=await createImageBitmap(bl);d=im.width+'x'+im.height;}catch(e){d='(ico)';}out.push([sel,u.split('/').pop(),d,bl.size]);}
 const lg=document.querySelector('header h1 img.logo');out.push(['logo',lg.currentSrc.split('/').pop(),lg.complete,lg.naturalWidth]);return out;});
console.log(JSON.stringify(man,null,0).replace(/\],\[/g,'],\n['));console.log('sw',JSON.stringify(sw));
const h=await p.$('header');await h.screenshot({path:OUT});
console.log('bad',bad,'errs',errs);await b.close();
