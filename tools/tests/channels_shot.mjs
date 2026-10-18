// Channel re-route before/after map shots on Esri imagery: current build (fishing-apps) vs candidate (test-apps),
// iPhone 390x844 @2x and a wide 1280x860 view, for each view in views.json (tools/multisys/channels/views.py).
// OUT=/workspace/multisys/shots/channels  VIEWS=/workspace/multisys/work/channels/views.json
import puppeteer from 'puppeteer-core';import fs from 'fs';
const OUT=process.env.OUT||'/workspace/multisys/shots/channels';const V=JSON.parse(fs.readFileSync(process.env.VIEWS||'/workspace/multisys/work/channels/views.json'));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));const errs=[];
async function open(base,sys,vp){const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);
  p.on('pageerror',e=>errs.push(sys+' '+base+' pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|404/.test(m.text()))errs.push(sys+' console: '+m.text());});
  await p.setViewport(vp);await p.goto(base+'?sys='+sys+'#baffle',{waitUntil:'networkidle0',timeout:90000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
  await p.evaluate(()=>FT.showTab('map'));await sleep(1500);return{c,p};}
const VPS={iphone:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},wide:{width:1280,height:860,deviceScaleFactor:1}};
const bySys={};for(const v of V)(bySys[v.sys]=bySys[v.sys]||[]).push(v);
for(const sys in bySys){const dir=`${OUT}/${sys}/`;fs.mkdirSync(dir,{recursive:true});
  for(const [vn,vp] of Object.entries(VPS))for(const [lab,base] of [['before','http://localhost:18080/fishing-apps/'],['after','http://localhost:18080/test-apps/']]){
    const {c,p}=await open(base,sys,vp);
    for(const v of bySys[sys]){await p.evaluate((la,lo,z)=>FT.mapDebug.map.setView([la,lo],z,{animate:false}),v.lat,v.lng,vn==='iphone'?16:15);await sleep(3500);
      await p.screenshot({path:`${dir}${v.tag}-${vn}-${lab}.png`});}
    await c.close();}}
console.log('errs',errs.length?errs:'none');await b.close();
