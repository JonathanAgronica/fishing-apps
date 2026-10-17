import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const g=async u=>{const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);await p.goto(u,{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]');const t=await p.evaluate(()=>document.querySelector('#bt-stretch').innerText);await c.close();return t.split('\n');};
const A=await g('http://localhost:18080/fishing-apps/?sys=mary-river#baffle'),N=await g('http://localhost:18080/test-apps/?sys=mary-river#baffle');
A.forEach((l,i)=>{if(l!==N[i])console.log('-',l,'\n+',N[i]);});await b.close();
