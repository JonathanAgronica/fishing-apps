import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};
for(const sys of ['baffle','maroochy-river','kolan-river']){const p=await (await b.createBrowserContext()).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(BASE+'?sys='+sys+'#gauges',{waitUntil:'networkidle0',timeout:120000});await new Promise(r=>setTimeout(r,4000));
  const o=await p.evaluate(()=>{const T=document.getElementById('tab-gauges');const secs=[...T.children].filter(e=>e.offsetParent!==null||e.tagName==='SECTION');const iL=secs.findIndex(s=>s.contains(document.getElementById('gLatest'))),iC=secs.findIndex(s=>s.contains(document.getElementById('gWrap')));return{iL,iC,n:secs.length,last:T.lastElementChild.contains(document.getElementById('gLatest')),lat:document.getElementById('gLatest').innerText.length};});
  ok(o.iC<o.iL&&o.last&&o.lat>10,`${sys}: chart first, latest readings last ${JSON.stringify(o)}`);ok(!errs.length,sys+' no JS errors '+errs.join('|'));
  if(sys!=='kolan-river')await p.screenshot({path:`/workspace/multisys/shots/declutter/gauges-${sys}.png`});}
await b.close();
