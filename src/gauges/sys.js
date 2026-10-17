/* ===================== Gauges tab — any river system (non-Baffle) =====================
   Shows the BoM tide/river gauges on this system (data/sysgauges/*.json, refreshed by the box routine every ~3 h)
   against this app's tide model at the gauge's chainage. The model is shifted by the median offset (gauges use their own datum);
   timing differences of highs/lows are what matter for calibration. */
(function(){'use strict';
const FT=window.FT,B=window.BT,$=id=>document.getElementById(id);if(!B.generic)return;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const E0=Date.UTC(2025,11,31,14),TZ='Australia/Brisbane';
const fT=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(ms)).replace(' am','am').replace(' pm','pm');
const G=(B.SYS.gauges||[]).slice().sort((a,b)=>(a.coastal-b.coastal)||((a.km||0)-(b.km||0)));
const root=$('tab-gauges');
root.innerHTML=`<section class="card"><h2>📡 Gauges — ${esc(FT.SYSNAME)}</h2><div id="sgHead" class="mut"></div></section><div id="sgList"></div>
<section class="card"><h2>ℹ️ About</h2><p class="mut">Readings: Bureau of Meteorology gauge tables, fetched about every 3 hours by the site’s update routine and kept for 72 h. Blue dashed = this app’s tide model at the gauge (shifted by the median difference, because each gauge has its own datum). Compare <b>timing</b> of highs/lows: if the gauge is consistently earlier/later, log a benchmark in the Tides tab at that spot to refine this system’s offsets. River gauges far upstream also show floods and pool levels the tide model doesn’t know about.</p></section>`;
if(!G.length){$('sgHead').innerHTML=`No BoM tide/river gauges are listed on ${esc(FT.SYSNAME)} — its tide model is ${FT.SYSINFO.conf==='C'?'<b>uncalibrated</b> (generic estimate)':'based on MSQ tide places'}. Benchmarks you log in the Tides tab are the way to calibrate it.`;return;}
function smooth(P,k){return P.map((p,i)=>{let s=0,n=0;for(let j=Math.max(0,i-k);j<=Math.min(P.length-1,i+k);j++){s+=P[j][1];n++;}return[p[0],s/n];});}
function events(P){const S=smooth(P,2),out=[];const W=150*60e3;
  for(let i=0;i<S.length;i++){const t=S[i][0];let mx=-1e9,mn=1e9,lo=t-W,hi=t+W;if(lo<S[0][0]||hi>S[S.length-1][0])continue;
    for(let j=i;j>=0&&S[j][0]>=lo;j--){mx=Math.max(mx,S[j][1]);mn=Math.min(mn,S[j][1]);}for(let j=i;j<S.length&&S[j][0]<=hi;j++){mx=Math.max(mx,S[j][1]);mn=Math.min(mn,S[j][1]);}
    const v=S[i][1];const l=out[out.length-1];
    if(v===mx&&v>mn+0.08){if(!(l&&l.hi&&t-l.t<3*3600e3))out.push({t,h:v,hi:true});}
    else if(v===mn&&v<mx-0.08){if(!(l&&!l.hi&&t-l.t<3*3600e3))out.push({t,h:v,hi:false});}}
  return out;}
function chart(P,M,off){const W=420,H=170,L=34,R=6,T=10,Bm=22,pw=W-L-R,ph=H-T-Bm;const t0=P[0][0],t1=P[P.length-1][0];
  const ys=P.map(p=>p[1]).concat(M.map(m=>m[1]+off));const y0=Math.min(...ys),y1=Math.max(...ys)+0.01;
  const X=t=>L+(t-t0)/(t1-t0)*pw,Y=v=>T+ph-(v-y0)/(y1-y0)*ph;let o=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:#0b1a1c;border-radius:8px">`;
  for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4;o+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#25464b"/><text x="${L-3}" y="${Y(v)+4}" fill="#9db5b1" font-size="10" text-anchor="end">${v.toFixed(1)}</text>`;}
  const d0=new Date(t0+10*3600e3);d0.setUTCHours(0,0,0,0);for(let t=d0.getTime()-10*3600e3+864e5;t<t1;t+=864e5){o+=`<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${T+ph}" stroke="#35585e" stroke-dasharray="2 3"/><text x="${X(t)+2}" y="${H-6}" fill="#9db5b1" font-size="10">${new Intl.DateTimeFormat('en-AU',{timeZone:TZ,weekday:'short',day:'numeric'}).format(new Date(t+3600e3))}</text>`;}
  const tn=Date.now();if(tn>t0&&tn<t1+6*3600e3)o+=`<line x1="${X(Math.min(tn,t1))}" x2="${X(Math.min(tn,t1))}" y1="${T}" y2="${T+ph}" stroke="#ffd38a"/>`;
  o+=`<polyline fill="none" stroke="#5cc8ff" stroke-width="1.6" stroke-dasharray="5 3" points="${M.filter(m=>m[0]>=t0&&m[0]<=t1).map(m=>X(m[0]).toFixed(1)+','+Y(m[1]+off).toFixed(1)).join(' ')}"/>`;
  o+=`<polyline fill="none" stroke="#ff8a7a" stroke-width="1.8" points="${P.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ')}"/>`;
  return o+'</svg>';}
async function getJSON(u){const r=await fetch(u+'?t='+Math.floor(Date.now()/6e5),{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);return{j:await r.json(),cached:!!r.headers.get('x-ft-cache')};}
let done=false;
async function render(){if(done)return;done=true;
  let idx=null;try{idx=(await getJSON('data/sysgauges/index.json')).j;}catch(e){}
  $('sgHead').innerHTML=`${G.filter(g=>!g.coastal).length} gauge(s) on the channel${G.some(g=>g.coastal)?' + '+G.filter(g=>g.coastal).length+' coastal/port station(s) near the mouth':''}. Model confidence: <b>${FT.SYSINFO.conf}</b> — ${esc(FT.CONF[FT.SYSINFO.conf][1])}.${idx&&idx.fetched?` Last fetched ${fT(idx.fetched*60e3)}.`:''}`;
  $('sgList').innerHTML=G.map(g=>`<section class="card" id="sg-${g.id}"><h2 style="font-size:1rem">${esc(g.name)} <span class="mut" style="font-weight:400">· ${g.id}</span></h2>
    <div class="mut">${g.coastal?'Coastal / port station near the mouth (not used as a model node)':`km ${g.km.toFixed(1)} ${esc(g.lineName||'')}`}${g.fit&&g.fit.HW?` · fitted lag HW ${Math.round(g.fit.HW.lag)} min${g.fit.LW&&g.fit.LW.n>=3?', LW '+Math.round(g.fit.LW.lag)+' min':''} after ${esc(B.SYS.port.name)}`:''} · <a href="https://www.bom.gov.au/fwo/${g.tab}/${g.tab}.${g.id}.tbl.shtml" target="_blank" rel="noopener">BoM table ↗</a></div>
    <div class="sgBody"><span class="spin"></span> loading…</div></section>`).join('');
  for(const g of G){const el=document.querySelector('#sg-'+g.id+' .sgBody');
    try{const {j,cached}=await getJSON('data/sysgauges/'+g.id+'.json');const P=j.pts.map(p=>[p[0]*60e3,p[1]]);if(P.length<6){el.innerHTML='<span class="mut">No recent readings.</span>';continue;}
      const t0=P[0][0],t1=P[P.length-1][0],h0=(t0-E0)/3.6e6,h1=(t1-E0)/3.6e6+6;
      const pr=B.predictAt(g.coastal?0:g.km,h0,h1,{line:g.coastal?'M':(g.line||'M')});
      const M=[];for(let h=h0;h<=h1;h+=0.1){const v=pr.curve(h);if(v!=null)M.push([E0+h*3.6e6,v]);}
      const dif=P.map(p=>{const v=pr.curve((p[0]-E0)/3.6e6);return v==null?null:p[1]-v;}).filter(x=>x!=null).sort((a,b)=>a-b);const off=dif.length?dif[dif.length>>1]:0;
      const ev=events(P),mx=pr.ext.map(e=>({t:E0+e.t*3.6e6,hi:e.hi}));const dh=[],dl=[];
      for(const e of ev){let b=null;for(const m of mx){if(m.hi!==e.hi)continue;const d=(e.t-m.t)/60e3;if(Math.abs(d)<240&&(!b||Math.abs(d)<Math.abs(b)))b=d;}if(b!=null)(e.hi?dh:dl).push(b);}
      const avg=a=>a.reduce((s,x)=>s+x,0)/a.length,fmt=a=>a.length?`${avg(a)>=0?'+':''}${Math.round(avg(a))} min (n=${a.length})`:'—';
      const last=P[P.length-1],age=(Date.now()-last[0])/60e3;
      el.innerHTML=`<div class="row" style="justify-content:space-between;margin:4px 0"><b style="font-size:1.1rem">${last[1].toFixed(2)} m</b><span class="mut">${fT(last[0])}${age>240?` <span style="color:#ff9b8a">(${Math.round(age/60)} h old)</span>`:''}${cached?' · offline copy':''}</span></div>`+chart(P,M,off)+
        `<div class="mut" style="margin-top:4px"><span style="color:#ff8a7a">━ gauge</span> · <span style="color:#5cc8ff">┅ model</span> (${off>=0?'+':''}${off.toFixed(2)} m datum shift) · gauge vs model timing: highs ${fmt(dh)}, lows ${fmt(dl)}${g.coastal?'':' — + = gauge later than model'}</div>`;}
    catch(e){el.innerHTML=`<span class="mut">Gauge data not available yet (${esc(e.message)}). It appears after the next routine update.</span>`;}}}
FT.onTab.push(t=>{if(t==='gauges')render();});
if(document.body.dataset.tab==='gauges')render();
})();
