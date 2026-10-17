import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();await p.goto('http://localhost:18080/test-apps/?sys=baffle#bite',{waitUntil:'networkidle0'});
console.log(await p.evaluate(()=>{const o=[];for(const t of ['bite','baffle','gauges','cal','map','log']){const T=document.getElementById('tab-'+t);
 for(const s of T.children){o.push(t+' > '+s.tagName+'#'+s.id+'.'+s.className+' :: '+[...s.children].map(c=>c.tagName+(c.id?'#'+c.id:'')+((c.getAttribute('class')?'.'+c.getAttribute('class').replace(/ /g,'.'):''))+(c.tagName[0]==='H'?'('+c.textContent.slice(0,25)+')':'')).join(' '));}}
 o.push('SYSBAR: '+document.querySelector('.sysbar')?.outerHTML.slice(0,600));return o.join('\n');}));await b.close();
