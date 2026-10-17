/* ---- declutter: key answer first, secondary detail in remembered drop-downs; one shared spot picker ---- */
(function(){const K='ft_dc';let ST={};try{ST=JSON.parse(localStorage.getItem(K)||'{}')||{};}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(ST));}catch(e){}};
FT.dcOpen=(k,def)=>window.__DC_OPEN?true:k in ST?!!ST[k]:!!def; /* __DC_OPEN: test hook (all drop-downs open) */
/* remember every .dc drop-down (also ones rendered later, e.g. the lure note) */
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.classList&&d.classList.contains('dc')&&d.dataset.k){ST[d.dataset.k]=d.open;save();}},true);
const mk=(k,title,def)=>{const d=document.createElement('details');d.className='dc';d.dataset.k=k;d.open=FT.dcOpen(k,def);const s=document.createElement('summary');s.innerHTML=title;d.appendChild(s);return d;};
/* wrap nodes (kept in order, same ids) into a drop-down placed where the first one was */
function wrap(nodes,k,title,def){nodes=nodes.filter(Boolean).sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1);if(!nodes.length)return null;const d=mk(k,title,def);nodes[0].before(d);nodes.forEach(n=>d.appendChild(n));return d;}
/* fold a whole card: its h2 becomes the summary */
function fold(sec,k,def,title){if(!sec)return null;const h=sec.querySelector(':scope>h2');const t=title||(h?h.innerHTML:k);if(h)h.remove();
  const d=mk(k,`<span class="dch">${t}</span>`,def);while(sec.firstChild)d.appendChild(sec.firstChild);sec.appendChild(d);sec.classList.add('dcard');return d;}
const secBy=(tab,re)=>[...document.querySelectorAll(`#tab-${tab}>section, #tab-${tab}>.card`)].find(s=>{const h=s.querySelector(':scope>h2');return h&&re.test(h.textContent);});
const $=id=>document.getElementById(id);const par=(el,sel)=>el&&el.closest(sel);
try{
/* ---------- Bite ---------- */
const locSec=secBy('bite',/Location/);if(locSec){const rows=[...locSec.querySelectorAll(':scope>.row')];
  const keep=rows.find(r=>r.querySelector('#mj-date'));wrap([...rows.filter(r=>r!==keep),$('mj-results')].filter(Boolean),'bLoc','🔎 Change location — search, GPS, creek spot',false);
  wrap([$('mj-tideSrc')],'bSrc','ℹ️ Tide source &amp; accuracy',false);
  const off=$('mj-tideOff');const lab=off&&off.closest('label');if(lab&&keep&&keep.contains(lab)){const d=locSec.querySelector('details[data-k=bLoc]');d&&d.appendChild(lab);}}
wrap([$('mj-stats')],'bDay','☀️ Day details — tides, sun, moon, weather',false);
{const w=$('mj-windows')&&$('mj-windows').closest('section'),sc=$('mj-summaryCard');if(w&&sc)sc.after(w);}
fold(secBy('bite',/How the score works/),'bWhy',false,'🧠 Why this score — weights &amp; method');
fold(secBy('bite',/rules reminder/),'bRules',false);
const ch=$('mj-chartWrap')&&$('mj-chartWrap').closest('section');if(ch)wrap([ch.querySelector(':scope>.legend'),$('mj-hours')],'bHours','Legend &amp; hour-by-hour scores',false);
const sd=secBy('bite',/7-day/);if(sd)wrap([sd.querySelector(':scope>p.mut')],'b7n','About the outlook',false);
/* ---------- Tides ---------- */
fold(secBy('baffle',/Whole stretch/),'tStretch',false);fold(secBy('baffle',/Benchmark log/),'tBench',false,'📝 Benchmark log — calibration (advanced)');
fold(secBy('baffle',/Live gauges/),'tLive',false);fold(secBy('baffle',/How predictions/),'tHow',false,'🧪 Accuracy &amp; method');
/* ---------- Gauges ---------- */
const gs=$('gStatsH')&&$('gStatsH').closest('section');if(gs){const h=$('gStatsH');const t=h.innerHTML;fold(gs,'gStats',false,t);}
wrap([$('gHelp')],'gHelp','How to read this chart',false);
{const gl=$('gLatest')&&$('gLatest').closest('section'),gt=document.getElementById('tab-gauges');if(gl&&gt){gt.appendChild(gl);gl.classList.add('glatest-bottom');}} /* chart first, latest readings at the bottom (all systems) */
/* ---------- Calendar ---------- */
wrap([$('calLegend'),$('calNote')],'cLeg','Legend &amp; notes',false);
/* ---------- Map ---------- */
const mc=document.querySelector('#tab-map .mcard');if(mc)wrap([mc.querySelector(':scope>p.mut')],'mHelp','How to use the map',false);
const ms=secBy('map',/My spots/);if(ms){const io=$('mExport')&&$('mExport').closest('.row');const nt=ms.querySelector(':scope>p.mut');const d=wrap([io,nt],'mIO','⚙ Backup / restore spots (JSON)',false);
  const bd=$('mBuiltDet');if(d&&bd){const s2=bd.closest('section');d.appendChild(bd);if(s2&&!s2.children.length)s2.remove();}}
/* ---------- Catch log ---------- */
const ca=$('cActiveCard');if(ca)wrap([ca.querySelector(':scope>p.mut')],'lWhy','Why log blank sessions?',false);
fold(secBy('log',/Sharing/),'lShare',false,'🔒 Sharing &amp; privacy');fold(secBy('log',/Community/),'lCom',false);
const ls=secBy('log',/My sessions/);if(ls)wrap([$('cExport')&&$('cExport').closest('.row')],'lIO','⚙ Import / export CSV (old catches too)',false);
}catch(e){console.error('declutter',e);}
/* ---------- one shared spot picker in the header (drives Bite + Tides) ---------- */
try{const bar=document.querySelector('.sysbar');if(bar&&window.BT){const lab=document.createElement('label');lab.className='ftspot';lab.innerHTML='🎯 <select id="ftSpot" aria-label="Spot"></select>';bar.insertBefore(lab,bar.children[1]||null);
  const sel=lab.querySelector('select');
  const fill=()=>{const L=BT.LANDMARKS||[];const o=(l,i)=>`<option value="${i}">${l.custom?'★ ':''}${String(l.name).replace(/[&<]/g,c=>c==='&'?'&amp;':'&lt;')} · ${(+l.km).toFixed(1)} km</option>`;
    const mine=L.map((l,i)=>[l,i]).filter(x=>x[0].custom),bi=L.map((l,i)=>[l,i]).filter(x=>!x[0].custom);
    sel.innerHTML='<option value="">— spot —</option>'+(mine.length?'<optgroup label="My spots">'+mine.map(x=>o(...x)).join('')+'</optgroup>':'')+'<optgroup label="Creek spots">'+bi.map(x=>o(...x)).join('')+'</optgroup>';sync();};
  const sync=()=>{const L=FT.biteLoc&&FT.biteLoc();if(!L||L.km==null){sel.value='';return;}const i=(BT.LANDMARKS||[]).findIndex(l=>L.spotId?l.id===L.spotId:Math.abs(l.km-L.km)<0.01&&(!l.line||!L.line||l.line===L.line));sel.value=i>=0?String(i):'';};
  sel.onchange=()=>{const l=(BT.LANDMARKS||[])[+sel.value];if(!l||sel.value==='')return;const ll=FT.spots?FT.spots.latLng(l):BT.pointAtKm(l.km);const sx=BT.generic?' — '+(FT.SYSSHORT||''):' — Baffle Ck';
    FT.biteSetLoc&&FT.biteSetLoc(Object.assign({name:l.name+sx,lat:ll[0],lng:ll[1],tz:'Australia/Brisbane',baffleKm:l.km,spotId:l.id||null},l.line?{baffleLine:l.line}:{},BT.generic?{sys:FT.SYS}:{}));
    try{FT.baffleSelect&&FT.baffleSelect(l.km,l.name,l.line);}catch(e){}};
  fill();FT.onTab.push(()=>sync());if(FT.spots)FT.spots.onChange.push(fill);FT.spotPickerSync=sync;setInterval(()=>{if(document.activeElement!==sel)sync();},4000);}}catch(e){console.error('ftSpot',e);}
document.body.dataset.dc='1';})();
