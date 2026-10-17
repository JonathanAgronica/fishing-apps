import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto('http://localhost:18080/test-apps/#bite',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
console.log(await p.evaluate(()=>{const s=document.querySelector('section[data-tab=bite],#bite,[id*=bite]');return [...document.querySelectorAll('[id]')].filter(e=>e.offsetParent&&e.closest('main,body')).map(e=>e.id+':'+e.tagName+':'+(e.innerText||'').slice(0,50).replace(/\n/g,' ')).slice(0,120).join('\n');}));
await b.close();
