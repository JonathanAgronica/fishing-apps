import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';
const SH=process.env.SHOTS||'/workspace/multisys/shots/gauges/';
const SYS=(process.env.SYSL||'baffle,burnett-river,mary-river,maroochy-river,brisbane-river,kedron-brook,littabella-creek').split(',');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('requestfailed',r=>{if(!/tile|arcgis/.test(r.url()))errs.push('reqfail '+r.url());});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
for(const id of SYS){
  await p.goto(BASE+'?sys='+id+'#gauges',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForSelector('body[data-sys-ready="'+id+'"]',{timeout:60000});
  await p.evaluate(()=>window.FT.showTab('gauges'));
  await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:60000}).catch(()=>errs.push(id+': gaugesReady timeout'));await sleep(800);
  const r=await p.evaluate(()=>{const G=window.__FT_GAUGES?window.__FT_GAUGES():null;
    return{title:(document.getElementById('gTitle')||{}).innerText,latest:document.getElementById('gLatest').innerText.replace(/\n/g,' | ').slice(0,500),
    upd:document.getElementById('gUpd').innerText,fresh:document.getElementById('gFresh').innerText.slice(0,300),
    legend:[...document.querySelectorAll('#gLegend button')].map(b=>(b.classList.contains('off')?'-':'+')+b.innerText),
    stats:[...document.querySelectorAll('#gStats tr')].map(t=>t.innerText.replace(/\t/g,' | ')).slice(0,14),
    nEvents:document.querySelectorAll('#gEvents tr').length,svgLen:document.getElementById('gChart').innerHTML.length,
    view:G&&G.view?(G.view[1]-G.view[0])/1440:null,off:G&&G.OFF};});
  console.log('\n=== '+id,JSON.stringify(r,null,1));
  await p.screenshot({path:SH+id+'-gauges.png',fullPage:true});
  // interactions: range buttons, toggle, tap
  if(id!=='baffle'){
    for(const rr of ['2','30','all','7']){await p.click(`.gbar [data-r="${rr}"]`);await sleep(rr==='all'?1500:300);}
    const v=await p.evaluate(()=>{const G=window.__FT_GAUGES();return (G.view[1]-G.view[0])/1440;});
    await p.click('#gLegend button:nth-child(2)');await sleep(200);
    await p.evaluate(()=>document.getElementById('gChart').scrollIntoView({block:'start'}));await sleep(300);const box=await (await p.$('#gChart')).boundingBox();await p.touchscreen.tap(box.x+box.width*0.7,box.y+120);await sleep(300);
    const tip=await p.evaluate(()=>document.getElementById('gTip').innerText.replace(/\n/g,' | '));
    console.log('range7 days',v.toFixed(1),'tip:',tip.slice(0,300));
    await p.click('#gLegend button:nth-child(2)');await sleep(200);
  }
}
console.log('\nERRORS',JSON.stringify(errs,null,1));
await b.close();
