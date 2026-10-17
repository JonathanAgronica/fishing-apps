import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function dump(u){const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);await p.goto(u+'?sys=maroochy-river#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]');
 return p.evaluate(()=>{const B=BT,o={};const h0=B.dateToH(2026,10,5,0,0);for(const km of [0,10,21.21,22,24,26,26.39]){const P=B.predictAt(km,h0,h0+24*14,{line:'M'});o[km]={e:P.inWin.map(e=>[e.t,e.h,e.hi]),hwU:Math.round(P.cal.hwU),lwU:Math.round(P.cal.lwU)};}return o;});}
const A=await dump('http://localhost:18080/fishing-apps/'),N=await dump('http://localhost:18080/test-apps/');
for(const k in A){const a=A[k].e,n=N[k].e;let dt=[],dh=[];for(const e of a){const m=n.find(x=>x[2]===e[2]&&Math.abs(x[0]-e[0])<3);if(m){dt.push((m[0]-e[0])*60);dh.push(m[1]-e[1]);}}
 const mx=x=>x.length?Math.max(...x.map(Math.abs)).toFixed(2):'-';console.log('km',k,'events',a.length,n.length,'max|dt| min',mx(dt),'max|dh| m',mx(dh),'U old',A[k].hwU,A[k].lwU,'new',N[k].hwU,N[k].lwU);}
await b.close();
