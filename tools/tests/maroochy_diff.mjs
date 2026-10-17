import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function dump(u){const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);await p.goto(u+'?sys=maroochy-river#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]');
 return p.evaluate(()=>{const B=BT,o={};for(let km=0;km<=26.4;km+=0.5){const h0=B.dateToH(2026,10,12,0,0);const P=B.predictAt(km,h0,h0+72,{line:'M'});o[km]=JSON.stringify(P.inWin.map(e=>[e.t.toFixed(3),e.h.toFixed(3)]));}return {o,ref:B.REFKM};});}
const A=await dump('http://localhost:18080/fishing-apps/'),N=await dump('http://localhost:18080/test-apps/');
console.log('ref',A.ref,N.ref);for(const k in A.o)if(A.o[k]!==N.o[k])console.log('diff km',k);await b.close();
