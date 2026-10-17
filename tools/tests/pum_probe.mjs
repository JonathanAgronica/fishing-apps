import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function mk(base){const p=await (await b.createBrowserContext()).newPage();await p.goto(base+'#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]');return p;}
const pa=await mk('http://localhost:18080/fishing-apps/'),pb=await mk('http://localhost:18080/test-apps/');
const f=async(p,kms,line)=>p.evaluate(async(kms,line)=>{const S=await (await fetch('data/systems/pumicestone-passage.json')).json();const B=window.FT.makeSystemBT(S);
  return kms.map(km=>{const P=B.predictAt(km,7000,7030,{line});return{km,e:P.inWin.map(e=>[+e.t.toFixed(3),+e.h.toFixed(3),e.hi]),fed:B.fedFrom?B.fedFrom(km,line):null};});},kms,line);
const K=[0,3,8.63,12,14.83];const A=await f(pa,K,'M'),Bq=await f(pb,K,'M');
console.log('passage km 0–14.83 identical:',JSON.stringify(A)===JSON.stringify(Bq.map(x=>({km:x.km,e:x.e,fed:null}))));
const t4a=await f(pa,[15.29,18,22.4],'T4'),t4b=await f(pb,[15.29,18,22.4],'T4');
for(let i=0;i<3;i++){const d=t4a[i].e.map((e,j)=>t4b[i].e[j]?[Math.round((t4b[i].e[j][0]-e[0])*60),+(t4b[i].e[j][1]-e[1]).toFixed(3)]:null);console.log('T4 Glass Mtn',t4a[i].km,'max |dt| min',Math.max(...d.filter(Boolean).map(x=>Math.abs(x[0]))),'max |dh|',Math.max(...d.filter(Boolean).map(x=>Math.abs(x[1]))));}
const prof=await pb.evaluate(async()=>{const S=await (await fetch('data/systems/pumicestone-passage.json')).json();const B=window.FT.makeSystemBT(S);const o=[];
  for(const [km,line] of [[0,'M'],[8.63,'M'],[14.83,'M'],[20,'M'],[22.27,'M'],[24.97,'M'],[25.4,'M'],[27,'M'],[31.04,'M'],[35.1,'M'],[38.53,'M'],[40.54,'M'],[26.5,'T5'],[28,'T5'],[25.5,'T6'],[37,'T8']]){
    const P=B.predictAt(km,7000,7360,{line});const H=P.inWin.filter(e=>e.hi),L=P.inWin.filter(e=>!e.hi);const c=B.calAt(km,{line});
    const r=(H.reduce((a,e)=>a+e.h,0)/H.length)-(L.reduce((a,e)=>a+e.h,0)/L.length);const f=B.fedFrom(km,line);
    o.push([line,km,'N'+Math.round(f.n*100)+'%','meanRange '+r.toFixed(2),'HWlag vs Scarb '+Math.round(c.hwLag),'LWlag '+Math.round(c.lwLag),'±'+Math.round(c.hwU)+'/'+Math.round(c.lwU),c.est?'est':'']);}
  return o;});
prof.forEach(r=>console.log(r.join('  ')));
await b.close();
