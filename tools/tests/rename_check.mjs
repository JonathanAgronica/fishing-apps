import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const [w,sys] of [[400,'baffle'],[400,'brisbane-river'],[360,'pumicestone-passage'],[400,'burnett-river']]){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:w,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys='+sys+'#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
const r=await p.evaluate(()=>{const t=e=>Math.round(document.querySelector(e).getBoundingClientRect().top);return{sel:t('#sysSel'),gps:t('#sysGps'),off:t('#sysOff'),title:document.title,h1:document.querySelector('header h1').innerText,tab:document.querySelector('nav.tabs a[data-tab=baffle]').innerText,foot:document.querySelector('footer').innerText.split('\n').pop(),apple:document.querySelector('meta[name=apple-mobile-web-app-title]').content};});
console.log(w,sys,JSON.stringify(r),errs);if(sys!=='burnett-river')await p.screenshot({path:`/workspace/multisys/shots/rename-${sys}-${w}.png`,clip:{x:0,y:0,width:w,height:260}});await ctx.close();}
await b.close();
