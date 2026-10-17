import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();p.on('pageerror',e=>console.log('PE',e.message));p.on('console',m=>console.log('C',m.type(),m.text()));
await p.goto('http://localhost:18080/fishing-apps/baffle-tides/',{waitUntil:'networkidle0'});await new Promise(r=>setTimeout(r,3000));
console.log(p.url(),await p.evaluate(()=>JSON.stringify(document.body.dataset)));await b.close();
