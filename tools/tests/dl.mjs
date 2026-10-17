import puppeteer from 'puppeteer-core'; import fs from 'fs';
const [,, outdir, ...pairs]=process.argv;
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.goto('https://www.data.qld.gov.au/dataset/bundaberg-tide-gauge-predicted-high-low-data',{waitUntil:'networkidle2',timeout:90000});
await new Promise(r=>setTimeout(r,4000));
for(let i=0;i<pairs.length;i+=2){
  const txt=await p.evaluate(async u=>{const r=await fetch(u);return r.status+'\n'+await r.text();},pairs[i+1]);
  const nl=txt.indexOf('\n');console.log(pairs[i],txt.slice(0,nl),txt.length);fs.writeFileSync(outdir+'/'+pairs[i],txt.slice(nl+1));
}
await b.close();
