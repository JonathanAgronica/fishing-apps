import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH='/workspace/multisys/shots/cal/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const sys of ['maroochy-river','baffle']){const p=await (await b.createBrowserContext()).newPage();await p.setBypassServiceWorker(true);await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys='+sys+'#cal',{waitUntil:'networkidle0'});await p.waitForFunction(()=>document.body.dataset.calDone&&document.body.dataset.calDone===String(FT.cal.st.gen),{timeout:600000});
const ov=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));console.log(sys,'overflow',JSON.stringify(ov));
await p.screenshot({path:SH+`cal-${sys}-month.png`});
const d=await p.evaluate(()=>{const ds=Object.keys(FT.cal.st.data).sort()[8];FT.cal.openDay(ds);return ds;});await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},d);await new Promise(r=>setTimeout(r,300));
await p.screenshot({path:SH+`cal-${sys}-detail.png`});}
await b.close();
