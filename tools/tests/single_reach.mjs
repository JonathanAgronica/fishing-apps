import fs from 'fs';import vm from 'vm';
const h=fs.readFileSync('/workspace/baffle-tides/index.html','utf8');const g={console};g.window=g;vm.createContext(g);
vm.runInContext(h.split('<script id="data">')[1].split('</script>')[0]+'\n'+h.split('<script id="core">')[1].split('</script>')[0],g);const B=g.BT;
const [y0,m0,d0,n]=process.argv.slice(2).map(Number);
for(let k=0;k<n;k++){const t0=B.dateToH(y0,m0,d0+k,0,0);const P=B.predictAt(35.25,t0,t0+24,{});
  const st=P.ext.filter(e=>e.stand&&e.t>=t0&&e.t<t0+24);if(!st.length)continue;
  for(const e of st){let lo=35.25;for(let km=35.25;km>=15;km-=0.05){const Q=B.predictAt(km,t0-12,t0+36,{line:'B'});const hit=Q.ext.some(x=>x.stand&&Math.abs(x.src.t-e.src.t)<0.01);if(hit)lo=km;else{if(process.env.DBG)console.log("miss",km,Q.ext.filter(x=>x.stand).map(x=>x.src.t),e.src.t);break;}}
   const E=P.ext.find(x=>x.src.t===e.src.t);
   console.log(B.dayStr(t0),'stand ~'+B.fmtT(e.t),'Bund H',e.src.h.toFixed(2),'rise',(e.rB??0).toFixed(2),'→ single high down to',lo.toFixed(2),'km');}}
