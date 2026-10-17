/* ---- Lure colour guide for mangrove jack (pure; window.FTLure) ----
   Blend of a generic clarity × light chart with QLD estuary jack lore: natural prawn / mullet / pearl in clear bright water,
   dark silhouettes (black, purple, motor oil, deep red) in dirty water and at night, gold / copper / pink flash in tea-coloured tannin water,
   chartreuse & firetiger when stained but light still gets in; rattles / vibes when it's muddy. A guide, not gospel. */
(function(G){
const C={pearl:['Pearl / white','#f3efe4'],prawn:['Natural prawn','#c9a27e'],mullet:['Silver mullet','#a9b4ba'],ghost:['Translucent / ghost','#dfeceb'],
  green:['Green / olive','#6b8e4e'],chart:['Chartreuse','#b8f02a'],orange:['Fluoro orange','#ff8a1f'],red:['Deep red','#a3122a'],gold:['Gold flash','#d4a017'],
  pink:['Pink','#ff6fae'],black:['Black','#151515'],blue:['Dark blue','#1f3f9f'],purple:['Purple','#5b2a86'],fire:['Firetiger','linear-gradient(90deg,#b8f02a,#ff8a1f 55%,#1d3b1a)'],
  glow:['Glow','#d8ffb0'],uv:['UV','#8a5cff'],oil:['Motor oil','#4a3a1a']};
/* top-3 per clarity × light (chart, re-ordered / swapped with local lore) */
const T={clear:{bright:['prawn','pearl','mullet'],overcast:['pearl','fire','red'],low:['pearl','uv','red'],night:['black','blue','uv']},
  stained:{bright:['chart','gold','orange'],overcast:['chart','fire','purple'],low:['fire','orange','red'],night:['purple','chart','glow']},
  muddy:{bright:['black','chart','gold'],overcast:['black','purple','chart'],low:['black','blue','glow'],night:['black','purple','glow']}};
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
/* o: {stage:'ri'|'flood'|'tot'|'ro'|'bot', range, rangeMax, km, maxKm, flood:{phase,day}|null, rain24, rain, wind, cloud, code, alt, moon(0..1), tide:boolean} */
function advise(o){const why=[];let c=0.22;
  const up=o.km!=null&&o.maxKm?cl(o.km/o.maxKm):0;const tannin=up>0.55;c+=0.28*up;if(up>0.55)why.push('upper creek (tannin)');
  if(o.tide!==false&&o.range!=null&&o.rangeMax){const rN=cl(o.range/o.rangeMax);c+=0.24*(rN-0.55);if(rN>0.85)why.push('spring tide stirring');}
  const SG={ri:-0.13,flood:-0.08,tot:-0.1,ro:0.08,bot:0.15}[o.stage]||0;c+=SG;
  const F=o.flood;if(F){const d={rising:0.6,dirty:0.6,clearing:0.35-0.05*Math.max(0,(F.day||4)-4),prime:0.12,tapering:0.05,runoff:0.25}[F.phase]||0;c+=d;if(d>0.1)why.push(F.phase==='runoff'?'runoff':'flood '+F.phase);}
  if(o.rain24!=null&&o.rain24>3){c+=Math.min(0.25,o.rain24/40);why.push(Math.round(o.rain24)+' mm rain 24 h');}
  if(o.wind!=null&&o.wind>20){c+=cl((o.wind-20)/30,0,0.15);if(o.wind>28)why.push('wind chop');}
  c=cl(c);const clar=c<0.34?'clear':c<0.62?'stained':'muddy';
  let light;const a=o.alt;const storm=o.code!=null&&o.code>=95,dark=(o.cloud!=null&&o.cloud>=70)||storm||(o.rain!=null&&o.rain>1);
  if(a!=null&&a<-6)light='night';else if(a!=null&&a<6)light='low';else if(dark)light=a<12?'low':'overcast';else if(a!=null&&a<14)light='low';else light='bright';
  if(light==='night'&&o.moon!=null&&o.moon>0.75&&!(o.cloud>60))why.push('bright moon');
  let k=T[clar][light].slice();
  if(tannin&&clar!=='muddy'&&(light==='bright'||light==='overcast'))k=k.includes('gold')?['gold',...k.filter(x=>x!=='gold')]:['gold',k[0],k[1]];
  if(light==='night'&&o.moon>0.75&&!(o.cloud>60)&&clar==='clear')k=['black','pearl','blue'];
  k=k.slice(0,3);
  const rattle=clar==='muddy'||(light==='night'&&clar!=='clear');
  const prof=clar==='muddy'?'vibe or deep-diving hardbody'+(rattle?' with rattle':''):light==='night'?'surface walker or shallow hardbody'+(rattle?' with rattle':''):clar==='clear'?'natural prawn / shad soft plastic, weedless, slow past cover':'paddle-tail soft plastic or suspending hardbody';
  let prof2=prof;if(o.depth==='d')prof2=(clar==='muddy'?'heavier vibe (15–20 g)':'heavier vibe or weighted plastic (1/4–3/8 oz)')+' to get down the 6 m+ face'+(rattle?', rattle':'');
  else if(o.depth==='s'&&(light==='low'||light==='night'))prof2='shallow diver or topwater over the 1–3 m flat'+(rattle?', rattle':'');
  else if(o.depth==='s')prof2=prof.replace('deep-diving hardbody','shallow-running hardbody')+' — keep it shallow (1–3 m)';
  const ST={ri:'run-in',flood:'flood tide',tot:'top of tide',ro:'run-out',bot:'bottom of tide'}[o.stage]||'';
  const LW={bright:'bright',overcast:'overcast',low:'low light',night:'night'}[light];
  const head=`${clar[0].toUpperCase()+clar.slice(1)}${tannin&&clar!=='muddy'?' tannin':''}${ST?' '+ST:''}, ${LW}`;
  return{clarity:clar,c:Math.round(c*100)/100,light,tannin,keys:k,colours:k.map(x=>C[x][0]),swatch:k.map(x=>C[x][1]),rattle,profile:prof2,depth:o.depth||null,head,why,
    line:`${head}: ${k.map(x=>C[x][0].toLowerCase()).join(', ')}`};}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function sw(k){return `<span class="lsw" style="background:${C[k][1]}" title="${esc(C[k][0])}"></span>`;}
/* compact (one line) or full card */
function html(r,full){if(!r)return '';const chips=r.keys.map(k=>`<span class="lch">${sw(k)}${esc(C[k][0])}</span>`).join('');
  if(!full)return `<div class="lure1" title="Lure colour guide">🎨 ${r.keys.map(sw).join('')} <span>${esc(r.head)}: ${esc(r.keys.map(k=>C[k][0].toLowerCase()).join(', '))}</span></div>`;
  return `<div class="lure"><div class="lchs">${chips}</div><div class="mut">${esc(r.head)}${r.why.length?' · '+esc(r.why.join(', ')):''}</div><div class="mut">Profile: ${esc(r.profile)}.</div></div>`;}
G.FTLure={advise,html,COLOURS:C,TABLE:T};
/* shared bite-score ramp: red < 30 ≤ orange < 50 ≤ yellow < 65 ≤ light green < 80 ≤ dark green (stepped: easy to read in sun; numbers always shown) */
const RS=[[0,'#d7301f','#fff','0–30'],[30,'#f08a24','#111','30–50'],[50,'#f2d22e','#111','50–65'],[65,'#86d05a','#111','65–80'],[80,'#16843a','#fff','80+']];
const band=s=>{let b=RS[0];for(const r of RS)if(s>=r[0])b=r;return b;};
const ramp=s=>band(s)[1];ramp.ink=s=>band(s)[2];ramp.bands=RS;
ramp.legend=()=>RS.map(r=>`<span class="rlg"><i style="background:${r[1]}"></i>${r[3]}</span>`).join('');
G.FTRamp=ramp;
})(typeof window!=='undefined'?window:self);
