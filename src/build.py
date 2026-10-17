"""Build the combined 'Mac's Jacks' PWA (formerly 'Mac's Baffle Jacks') at the site root from the two source apps.
Sources: src/upstream/mangrove-jack/index.html (bite times) and src/upstream/baffle-tides/index.html (built, data embedded).
IDs are namespaced (mj-*, bt-*), small asserted patches wire the integration. Old /mangrove-jack/ and /baffle-tides/
become redirect pages + self-unregistering service workers. Previous separate-app build: build_v1_separate.py."""
import json, re, shutil, os, time
SRC='/workspace/fishing-site-src'; SITE='/workspace/fishing-site'
# repo root (src/ lives in the fishing-apps repo; /workspace/fishing-site-src is a symlink to it)
REPO=os.path.dirname(os.path.realpath(SRC)); MSOUT=f'{REPO}/tools/multisys/out'
VER=time.strftime('%Y%m%d%H%M')
MJ=open(f'{SRC}/upstream/mangrove-jack/index.html').read()
BTH=open(f'{SRC}/upstream/baffle-tides/index.html').read()

def between(s,a,b,start=0):
    i=s.index(a,start)+len(a); j=s.index(b,i); return s[i:j]
def patch(s,old,new,count=1):
    assert s.count(old)>=1, 'patch target missing: '+old[:80]
    return s.replace(old,new,count)

# ---------- split sources ----------
mj_css=between(MJ,'<style>','</style>'); bt_css=between(BTH,'<style>','</style>')
mj_main=between(MJ,'<main>','</main>'); bt_main=between(BTH,'<main>','</main>')
mj_core=between(MJ,'<script id="core">','</script>')
mj_ui=MJ[MJ.index('<script>',MJ.index('<script id="core">')):]; mj_ui=between(mj_ui,'<script>','</script>')
bt_data=between(BTH,'<script id="data">','</script>')
# Baffle side creeks + Euleilah upstream extension (sides/make_sides.py -> sides/baffle_sides.json; appended, lower Euleilah unchanged)
SIDES=json.load(open(f'{SRC}/sides/baffle_sides.json'))
assert len(SIDES['sides'])>=8 and SIDES['euCalEnd']>31 and SIDES['euLim']>SIDES['euCalEnd']-16.38, 'side-creek data looks wrong'
bt_data=bt_data.rstrip().rstrip(';')+';\n(function(D,X){D.sides=X.sides;D.euCalEnd=X.euCalEnd;D.euleilah=D.euleilah.concat(X.euExt);})(window.BAFFLE_DATA,'+json.dumps({k:SIDES[k] for k in ('sides','euCalEnd','euExt')},separators=(',',':'),ensure_ascii=False)+');'
bt_core=between(BTH,'<script id="core">','</script>')
bt_ui=BTH[BTH.index('<script>',BTH.index('<script id="core">')):]; bt_ui=between(bt_ui,'<script>','</script>')
bt_foot=between(BTH,'<footer>','</footer>'); mj_foot=between(MJ,'<footer>','</footer>')

bt_core=patch(bt_core,"root.BT={nowH,","root.BT={fuAll,nowH,")
# ---------- patches: bite core ----------
# non-alternating extremes (Baffle upper creek: weak highs removed => consecutive pool-level lows)
mj_core=patch(mj_core,"if(!prev||!next)return null;","if(!prev||!next)return null;if(prev.high===next.high)return{v:0.5,label:prev.high?'Slack high':'No tide reaching here (pool level)',prev,next,rising:false,ri:0,riRef:null};")

# ---------- patches: bite UI ----------
mj_main=patch(mj_main,'<ul id="results"></ul>','''<ul id="results"></ul>
    <div class="row" style="margin-top:8px"><label class="mut" style="flex:1 1 220px">Baffle Creek spot <select id="bafSel" style="width:100%"><option value="">— pick a Baffle Creek landmark —</option></select></label></div>''')
mj_main=patch(mj_main,'<button class="pri" id="goBtn">Calculate</button>','<button class="pri" id="goBtn">Calculate</button>\n      <button id="planBtn" title="Suggested fish / move / rest schedule for this date">🗓 Plan my day</button>')
mj_main=patch(mj_main,'<p class="mut" id="locInfo" style="margin:8px 0 0"></p>','<p class="mut" id="locInfo" style="margin:8px 0 0"></p>\n    <div id="tideSrc" class="src"></div>')
mj_ui=patch(mj_ui,"let state={};","""if(loc.baffleKm===undefined)loc.baffleKm=null;
let state={};
const FT=window.FT;
const E0=Date.UTC(2025,11,31,14); /* Baffle model hour 0 = 2026-01-01 00:00 AEST */
const GENB=!!BT.generic,SFX=' — '+(GENB?FT.SYSSHORT:'Baffle Ck');
function bafName(km,line){const L=BT.LANDMARKS.filter(l=>Math.abs(l.km-km)<0.3&&(!GENB||(l.line||'M')===(line||'M'))).sort((a,b)=>Math.abs(a.km-km)-Math.abs(b.km-km))[0];return L?L.name:null;}
function baffleTide(dateStr,km,line){const [y,m,d]=dateStr.split('-').map(Number);const h0=BT.dateToH(y,m,d-1,0,0),h1=BT.dateToH(y,m,d+8,0,0);
  const o=Object.assign({},FT.baffleOpts?FT.baffleOpts():{},GENB?{line:line||'M'}:line?{line}:{});const P=BT.predictAt(km,h0,h1,o);
  const fn=t=>{const v=P.curve((t-E0)/3.6e6);return v==null?null:v;};
  const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi}));
  return{fn,ext,cal:P.cal,weak:P.ext.filter(e=>e.weak&&!e.stand).length,stands:P.ext.filter(e=>e.stand).map(e=>({t:E0+e.t*3.6e6,t0:E0+e.standT0*3.6e6,t1:E0+e.standT1*3.6e6,H:e.sup.H,thr:e.sup.thr})),runIn:BT.runInStarts(km,h0,h1,o).map(r=>({t:E0+r.t*3.6e6,u:r.u,kind:r.kind}))};}
function snapLoc(l){if(l.baffleKm!==undefined)return l;let s=null;try{s=BT.snap(l.lat,l.lng);}catch(e){}
  if(GENB){if(s&&s.offKm<=0.6){l.baffleKm=+Math.min(BT.lineMax(s.lineId),s.km).toFixed(2);l.baffleLine=s.lineId;l.sys=FT.SYS;}else l.baffleKm=null;return l;}
  l.baffleKm=(s&&s.offKm<=0.6&&s.km<=BT.MAXKM)?+Math.min(BT.MAXKM,s.km).toFixed(2):null;if(l.baffleKm!=null&&s.lineId)l.baffleLine=s.lineId;return l;}
const bafIdx=()=>loc.baffleKm!=null?BT.LANDMARKS.findIndex(x=>Math.abs(x.km-loc.baffleKm)<0.01&&(!GENB||(x.line||'M')===(loc.baffleLine||'M'))):-1;
function rebuildBaf(){const sel=$('bafSel');sel.innerHTML='<option value="">— pick a '+esc(GENB?FT.SYSNAME:'Baffle Creek')+' spot —</option>'+BT.LANDMARKS.map((l,i)=>`<option value="${i}">${l.custom?'★ ':''}${esc(l.name)} (${l.km.toFixed(1)} km)</option>`).join('');
  const i=bafIdx();sel.value=i>=0?i:'';}
rebuildBaf();
$('bafSel').onchange=()=>{const v=$('bafSel').value;if(v==='')return;const l=BT.LANDMARKS[+v];const p=FT.spots?FT.spots.latLng(l):BT.pointAtKm(l.km);
  setLoc(Object.assign({name:l.name+SFX,lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:l.km},GENB?{baffleLine:l.line||'M',sys:FT.SYS}:l.line?{baffleLine:l.line}:{}));};
if(FT.spots)FT.spots.onChange.push(()=>{rebuildBaf();const v=$('bafSel').value;if(v!==''&&loc.baffleKm!=null){const nm=BT.LANDMARKS[+v].name+SFX;if(loc.name!==nm){loc.name=nm;localStorage.setItem('mj_loc',JSON.stringify(loc));setLocInfo();}}});""")
mj_ui=patch(mj_ui,"$('notices').innerHTML='';","document.body.dataset.biteReady='';$('notices').innerHTML='';const BZ=(loc.baffleKm!=null&&window.BT)?loc.baffleKm:null;$('tideOff').disabled=BZ!=null;")
mj_ui=patch(mj_ui,"if(sl.some(v=>v!=null)){","if(BZ!=null){/* tide comes from the Baffle along-creek model */}\n    else if(sl.some(v=>v!=null)){")
mj_ui=patch(mj_ui,"}else notice('🌊 Couldn\\'t load tide/sea-temperature data","}else if(BZ!=null)notice('🌡️ Sea-temperature data unavailable ('+esc(mr.reason&&mr.reason.message||'network error')+') — using a seasonal estimate. Tide still comes from the '+(GENB?esc(FT.SYSNAME)+' tide model':'Baffle model')+' (works offline).');\n  else notice('🌊 Couldn\\'t load tide/sea-temperature data")
mj_ui=patch(mj_ui,"  setLocInfo(cell);","""  let srcHtml;
  if(BZ!=null&&GENB){const BL=loc.baffleLine||'M';const r=baffleTide(dateStr,BZ,BL);tideFn=r.fn;ext=r.ext;runIn=r.runIn;const c=r.cal,nm=bafName(BZ,BL),I=FT.SYSINFO;
    srcHtml=`🌊 <b>Tide source: ${esc(FT.SYSNAME)} along-channel model</b> @ km ${BZ.toFixed(1)}${BL!=='M'?' '+esc(BT.lineName(BL)):''}${nm?' ('+esc(nm)+')':''} — ${esc(BT.SYS.port.name)} harmonics → ${c.generic?'<b>uncalibrated generic</b> lag &amp; height — benchmark me':'calibrated lag &amp; height'} (m AHD); confidence <b>${I.conf}</b>; timing ±${Math.round(c.hwU)} min highs, ±${Math.round(c.lwU)} min lows${c.trunc?'; lows here are a <b>pool level</b> (water starts rising = run-in)':''}${r.weak?`; ${r.weak} weak/no-show high(s) this week ignored`:''}. 🌡️ Sea temperature is Open-Meteo’s nearest offshore cell — SST differs by region (warmer up north, cooler in Moreton Bay in winter), and the bite model’s temperature thresholds were tuned for the Bundaberg coast. <button class="sm" id="openBaffle">🌊 Open in ${esc(FT.SYSSHORT)} tides</button>`;
    cell='';}
  else if(BZ!=null){const r=baffleTide(dateStr,BZ,loc.baffleLine);const dS=Date.UTC(+dateStr.slice(0,4),+dateStr.slice(5,7)-1,+dateStr.slice(8,10))-10*3600e3,sd=(r.stands||[]).filter(x=>x.t>=dS&&x.t<dS+864e5);tideFn=r.fn;ext=r.ext;runIn=r.runIn;const c=r.cal,nm=bafName(BZ);
    srcHtml=`🌊 <b>Tide source: Baffle Creek along-creek model</b> @ ${BZ.toFixed(1)} km${nm?' ('+esc(nm)+')':''} — Bundaberg harmonics → Winfield/Hills Rd/Essendean-calibrated lag &amp; height (m AHD); timing ±${Math.round(c.hwU)} min highs, ±${Math.round(c.lwU)} min lows${c.trunc?'; lows here are a <b>pool level</b> (truncated)':''}${r.weak?`; ${r.weak} weak/no-show high(s) this week ignored`:''}. Manual tide offset not used.${sd.length?`<br>🌗 <b>Single-high day here:</b> the small high ~${sd.map(x=>fmtT(x.t,'Australia/Brisbane')).join(', ')} doesn’t reach this far up (Bundaberg ${sd.map(x=>x.H.toFixed(2)).join(', ')} m LAT &lt; ${sd[0].thr.toFixed(2)} m needed here) — the water just stands ${sd.map(x=>fmtT(x.t0,'Australia/Brisbane')+'–'+fmtT(x.t1,'Australia/Brisbane')).join(', ')} and keeps falling: no run-in or top of tide from it; the run-out continues through.`:''} <button class="sm" id="openBaffle">🌊 Open in Baffle tides</button>`;
    cell='';}
  else srcHtml=tideFn?`🌊 <b>Tide source: Open-Meteo marine model</b> (offshore grid cell)${off?` + manual offset ${off>0?'+':''}${off} min`:' — use the tide offset for up-river spots'}.`:'🌊 <b>Tide source: none</b> — scoring on light, solunar, moon, temp &amp; weather.';
  if(BZ==null&&ext)runIn=ext.filter(x=>!x.high).map(x=>({t:x.t,u:30,kind:'low'}));
  $('tideSrc').innerHTML=srcHtml;
  if($('openBaffle'))$('openBaffle').onclick=()=>{FT.baffleSelect(BZ,bafName(BZ,loc.baffleLine),loc.baffleLine);FT.setDate($('date').value,'bite');FT.showTab('baffle');};
  setLocInfo(cell);""")
mj_ui=patch(mj_ui,"document.body.dataset.ready='1';","document.body.dataset.biteReady='1';")
mj_ui=patch(mj_ui,"function setLoc(l){loc=l;","function setLoc(l){loc=snapLoc(l);{const i=bafIdx();$('bafSel').value=i>=0?i:'';}")
mj_ui=patch(mj_ui,"$('date').onchange=run;","$('date').onchange=()=>{FT.setDate($('date').value,'bite');run();};\nFT.biteSetLoc=setLoc;FT.biteSetDate=v=>{if($('date').value!==v){$('date').value=v;run();}};\nFT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};")
mj_ui=patch(mj_ui,"setLocInfo();\nrun()","{const i=bafIdx();if(i>=0)$('bafSel').value=i;}\nsetLocInfo();\nrun()")
# catch-log hooks (FT.biteCtx / FT.biteLoc) inside the bite closure
CTX_JS=open(f'{SRC}/catchlog/ctx.js').read()
mj_ui=patch(mj_ui,"FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};","FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n"+CTX_JS)
mj_main=patch(mj_main,'placeholder="Search place (e.g. Elliott Heads, Baffle Creek)"','placeholder="Search place (e.g. Elliott Heads, Wartburg)"')

# ---------- run-in start emphasis (bite UI) ----------
mj_ui=patch(mj_ui,"let tideFn=null,ext=null,sstFn=null,wxFn=null,cell='';","let tideFn=null,ext=null,sstFn=null,wxFn=null,cell='',runIn=null;")
mj_ui=patch(mj_ui,"tideFn,ext,wxFn,sstFn,weekRange})","tideFn,ext,wxFn,sstFn,weekRange,runIn})")
mj_ui=patch(mj_ui,"  const stats=[\n","  const stats=[\n    ['🎣 Run-in starts',runInTxt(d)],\n")
mj_ui=patch(mj_ui,"function reasons(p){","function runInTxt(d){const tz=state.tz;if(!state.hasTide)return 'n/a (no tide data)';const L=d.runIns||[];\n  if(!L.length)return loc.baffleKm!=null?'none today (neap — tide not reaching)':'—';\n  return L.map(r=>`${fmtT(r.t,tz)} <span class=\"mut\" style=\"font-size:.75rem\">±${Math.round(r.u)}′ ${r.kind==='rise'?'water starts rising':'low turn'}</span>`).join('<br>');}\nfunction reasons(p){")
mj_ui=patch(mj_ui,"if(p.T){let s=p.T.label;s+=p.T.rising?","if(p.T&&p.T.riRef&&/run-in start|First of the run-in/.test(p.T.label)){const q=p.T.riRef;r.push(`${p.T.label} (${q.kind==='rise'?'water starts rising':'low turn'} ${fmtT(q.t,tz)} ±${Math.round(q.u)}′)`);}\n  else if(p.T){let s=p.T.label;s+=p.T.rising?")
mj_ui=patch(mj_ui,"  // windows highlight\n","""  // run-in start bands: halo = ±timing uncertainty, core = turn → +2 h
  for(const ri of state.days.flatMap(dd=>dd.runIns||[])){const u=ri.u*60e3,a0=Math.max(d.t0,ri.t-u),a1=Math.min(d.t1,ri.t+2*3600e3+u),c0=Math.max(d.t0,ri.t),c1=Math.min(d.t1,ri.t+2*3600e3);
    if(a1>a0)o+=`<rect x="${x(a0)}" y="${T}" width="${x(a1)-x(a0)}" height="${ph}" fill="#2fd3a0" opacity=".07"/>`;
    if(c1>c0)o+=`<rect x="${x(c0)}" y="${T}" width="${x(c1)-x(c0)}" height="${ph}" fill="#2fd3a0" opacity=".16"><title>Run-in start ${fmtT(ri.t,tz)} ±${Math.round(ri.u)} min</title></rect><rect x="${x(c0)}" y="${T+ph+13}" width="${x(c1)-x(c0)}" height="6" rx="3" fill="#2fd3a0"/>`;
    if(ri.t>=d.t0&&ri.t<d.t1)o+=`<text x="${x(ri.t)+3}" y="${T+24}" fill="#7ff0c8" font-size="11">▶ run-in ${fmtT(ri.t,tz)}</text>`;}
  // windows highlight
""")
mj_ui=patch(mj_ui,"<div class=\"ds\">${d.range!=null?'Range '","${(d.runIns||[]).length?`<div class=\"ds\" style=\"color:#7ff0c8\">🎣 Run-in ${d.runIns.map(r=>fmtT(r.t,state.tz)+(r.kind==='rise'?'*':'')).join(', ')}</div>`:''}<div class=\"ds\">${d.range!=null?'Range '")
mj_main=patch(mj_main,'<span><i style="background:var(--tide)"></i>Tide height (m, model)</span>','<span><i style="background:var(--tide)"></i>Tide height (m, model)</span>\n      <span><i style="background:#2fd3a0"></i>Run-in start (turn → +2 h; faint = ± timing)</span>')
# Baffle stretch: run-in starts column
bt_ui=patch(bt_ui,"<th>Lows</th><th>±</th></tr>'+B.LANDMARKS.map(","<th>Lows</th><th>Run-in starts</th><th>±</th></tr>'+B.LANDMARKS.map(")
bt_ui=patch(bt_ui,"<td class=\"lw\">${p.inWin.filter(e=>!e.hi).map(e=>B.fmtT(e.t)).join('<br>')}</td>","<td class=\"lw\">${p.inWin.filter(e=>!e.hi).map(e=>B.fmtT(e.t)).join('<br>')}</td><td style=\"color:#7ff0c8\">${B.runInStarts(l.km,t0,t1,o).filter(r=>r.t>=t0&&r.t<t1).map(r=>B.fmtT(r.t)+' <span class=\"mut\">±'+Math.round(r.u)+'′'+(r.kind==='rise'?' rise':'')+'</span>').join('<br>')||'<span class=\"mut\">—</span>'}</td>")
bt_ui=patch(bt_ui,"<tr><td colspan=\"5\" class=\"mut\">* weak/no visible high","<tr><td colspan=\"6\" class=\"mut\">Run-in starts = low turn (or, upper creek, when the water starts rising — marked ‘rise’) ± timing; the first ~2 h after it is the strongest tide window for jacks in Bite times. * weak/no visible high")
bt_ui=patch(bt_ui,"$('km').oninput=()=>{st.km=+$('km').value;st.landmark=null;","$('km').oninput=()=>{st.km=+$('km').value;st.landmark=null;st.bline=null;")
bt_ui=patch(bt_ui,"* weak/no visible high expected (tide doesn’t clear the upper-creek pool level).","'+(GEN?'* weak/no visible high expected (tide doesn’t clear the upper-creek pool level).':'* stand = single-high day: the small high doesn’t reach this far (water stands, no rise) — around neaps from ~22–23 km up on Baffle Ck; Euleilah Ck keeps both highs.')+'")

# ---------- patches: Baffle UI ----------
bt_ui=patch(bt_ui,"document.body.dataset.ready='1';","document.body.dataset.btReady='1';")
bt_ui=patch(bt_ui,"['date','hoff','badj'].forEach(id=>$(id).onchange=()=>{render();renderBench();});",
"""$('date').onchange=()=>{render();renderBench();FT.setDate($('date').value,'baffle');};
['bt-hoff','bt-badj'].forEach(id=>document.getElementById(id).onchange=()=>{render();renderBench();FT.biteRefreshIfBaffle&&FT.biteRefreshIfBaffle();});
const FT=window.FT;
FT.baffleOpts=opts;FT.baffleSelect=(km,name,line)=>selectKm(km,name,line);
if(FT.spots)FT.spots.onChange.push(()=>{rebuildLm(true);render();});
FT.baffleSetDate=v=>{if($('date').value!==v){$('date').value=v;render();renderBench();}};
$('toBite').onclick=()=>{const p=st.gps?[st.gps.lat,st.gps.lon]:(GEN?B.pointOnLine(st.km,st.line):B.pointAtKm(st.km));
  FT.setDate($('date').value,'baffle');
  FT.biteSetLoc(Object.assign({name:(st.landmark&&st.landmark!=='GPS fix'?st.landmark:(st.gps?'GPS spot':'km '+st.km.toFixed(1)))+' — '+(GEN?FT.SYSSHORT:'Baffle Ck'),lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:+st.km.toFixed(2)},GEN?{baffleLine:st.line,sys:FT.SYS}:{}));
  FT.showTab('bite');};""")
bt_ui=patch(bt_ui,"B.LANDMARKS.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${l.name} — ${l.km.toFixed(1)} km`;$('lm').appendChild(o);});\nconst o0=document.createElement('option');o0.value='';o0.textContent='— pick a landmark —';$('lm').prepend(o0);",
 """function rebuildLm(cur){const sel=$('lm');sel.innerHTML='<option value="">— pick a spot —</option>'+B.LANDMARKS.map((l,i)=>`<option value="${i}">${l.custom?'★ ':''}${esc(l.name)} — ${l.km.toFixed(1)} km</option>`).join('');
  if(cur&&st.landmark!=='GPS fix'){const i=B.LANDMARKS.findIndex(l=>Math.abs(l.km-st.km)<0.01&&(!GEN||(l.line||'M')===st.line));if(i>=0){st.landmark=B.LANDMARKS[i].name;sel.value=i;}else sel.value='';}}
rebuildLm(false);""")
bt_ui=patch(bt_ui,"const tags=(l.cal?'<span class=\"tag cal\">cal</span>':'')","const tags=(l.custom?'<span class=\"tag mine\">my spot</span>':'')+(l.alias?'<span class=\"tag\">renamed</span>':'')+(l.cal?'<span class=\"tag cal\">cal</span>':'')")
bt_ui=patch(bt_ui,"+(st.gps?` · GPS ","+(st.gps?((n=>n?` · nearest spot <b>${esc(n.name)}</b> (${Math.round(Math.abs(n.km-km)*1000)} m along)`:'')(window.FT.spots&&window.FT.spots.nearest(km,GEN?st.line:null,1.0))):'')+(st.gps?` · GPS ")
bt_main=patch(bt_main,'<button id="gps">📡 Use GPS</button>','<button id="gps">📡 Use GPS</button>\n      <button id="toBite" class="pri">🎣 Bite times here</button>')

# ---------- multi-system patches: bite UI ----------
# per-system bite location (Baffle keeps 'mj_loc'); a stored creek spot from another system falls back to this system's default spot
mj_ui=patch(mj_ui,"let loc=JSON.parse(localStorage.getItem('mj_loc')||'null')||{...DEF};","let loc=JSON.parse(localStorage.getItem(window.FT.k('mj_loc'))||'null')||(window.BT.generic?window.FT.defaultSpot():{...DEF});\nif(loc.baffleKm!=null&&(loc.sys||'baffle')!==window.FT.SYS)loc=window.FT.defaultSpot();")
mj_ui=mj_ui.replace("localStorage.setItem('mj_loc',","localStorage.setItem(window.FT.k('mj_loc'),")
assert "'mj_loc'" not in mj_ui.replace("window.FT.k('mj_loc')","")

# ---------- spot types (Run-in / Top of tide / Bottom of tide / Run-out): per-spot tide preference in the bite score ----------
SPT_CORE=open(f'{SRC}/spottypes/core.js').read(); SPT_UI=open(f'{SRC}/spottypes/ui.js').read()
mj_core=patch(mj_core,"/* --- main day computation --- */",SPT_CORE+"\n/* --- main day computation --- */")
mj_core=patch(mj_core,"const{dateStr,tz,lat,lng,tideFn,ext,wxFn,sstFn,stepMin=15,weekRange,runIn}=opts;","const{dateStr,tz,lat,lng,tideFn,ext,wxFn,sstFn,stepMin=15,weekRange,runIn,spotType}=opts;")
mj_core=patch(mj_core,"    const T=ext&&ext.length?tideFactor(t,ext,runIn,rangeN):null;\n","    let T=ext&&ext.length?tideFactor(t,ext,runIn,rangeN):null;\n    if(T&&spotType&&STYPES[spotType])T=spotTide(T,t,ext,runIn,spotType);\n")
mj_core=patch(mj_core,"root.MJ={","root.MJ={STYPES,stagePref,stageAt,spotTide,")
# the spot's own timing uncertainty travels with its extremes (blurs the stage preference)
mj_ui=patch(mj_ui,"const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi}));","const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi,u:e.u}));")
mj_ui=patch(mj_ui,"$('tideOff').disabled=BZ!=null;","$('tideOff').disabled=BZ!=null;const SPT=curSpotType(BZ);")
mj_ui=patch(mj_ui,"tideFn,ext,wxFn,sstFn,weekRange,runIn})","tideFn,ext,wxFn,sstFn,weekRange,runIn,spotType:SPT})")
mj_ui=patch(mj_ui,"state={tz,days,sel:0,dateStr,hasTide:!!tideFn};","state={tz,days,sel:0,dateStr,hasTide:!!tideFn,spotType:SPT,wxFn,sstFn,runId:Date.now()};")
mj_ui=patch(mj_ui,"  $('tideSrc').innerHTML=srcHtml;","  $('tideSrc').innerHTML=srcHtml+spotTypeNote(SPT);")
mj_ui=patch(mj_ui,"  drawChart(d);\n","  drawChart(d);try{renderMySpots();}catch(e){console.error('myspots',e);}\n")
mj_ui=patch(mj_ui,"/run-in start|First of the run-in/.test(p.T.label)","/run-in start|first of the run-in/i.test(p.T.label)")
mj_ui=patch(mj_ui,"\n  else if(p.T){let s=p.T.label;","\n  else if(p.T&&p.T.stype){const a=p.T.prev,b=p.T.next;r.push(`${p.T.label} (${a.high?'high':'low'} ${fmtT(a.t,tz)} → ${b.high?'high':'low'} ${fmtT(b.t,tz)})`);}\n  else if(p.T){let s=p.T.label;")
# landmark picker: custom spots show their type and carry the spot id
mj_ui=patch(mj_ui,"`<option value=\"${i}\">${l.custom?'★ ':''}${esc(l.name)} (${l.km.toFixed(1)} km)</option>`","`<option value=\"${i}\">${l.custom?'★ ':''}${l.custom&&l.type&&FT.spots&&FT.spots.TYPES[l.type]?'['+FT.spots.TYPES[l.type].s+'] ':''}${esc(l.name)} (${l.km.toFixed(1)} km)</option>`")
mj_ui=patch(mj_ui,"setLoc(Object.assign({name:l.name+SFX,lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:l.km},","setLoc(Object.assign({name:l.name+SFX,lat:p[0],lng:p[1],tz:'Australia/Brisbane',baffleKm:l.km,spotId:l.id},")
mj_ui=patch(mj_ui,"FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n","FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n"+SPT_UI+"\n")
mj_main=patch(mj_main,"""    <h2>🎯 Best bite windows</h2>
    <div id="windows"><span class="spin"></span> Loading…</div>
  </section>
""","""    <h2>🎯 Best bite windows</h2>
    <div id="windows"><span class="spin"></span> Loading…</div>
  </section>

  <section class="card">
    <h2>📌 My spots today</h2>
    <div id="mySpots"><span class="spin"></span></div>
  </section>
""")
mj_main=patch(mj_main,"    <details><summary>Solunar (≈16%)</summary>","""    <details><summary>Your spot types (Run-in · Top · Bottom · Run-out)</summary><p>Give your own spots a <b>type</b> on the Map tab — the stage of tide each one fishes best on. When the bite location is a typed spot, its tide score becomes <b>65% that spot’s preferred stage + 35% the general tide curve</b> above, using <b>that spot’s own predicted tide</b> (its km along the channel) and widened by its ± timing uncertainty:
      <br>• <b>Run-in</b> — from the run-in start (low turn, or water starting to rise over a pool-level low) through mid run-in; peak ~30–120 min after the turn.
      <br>• <b>Top of tide (TOT)</b> — about 1 h either side of the high: the top of the run-in, slack, and the first of the run-out.
      <br>• <b>Bottom of tide (BOT)</b> — about 1 h either side of the low (or resting low): the last of the run-out and the first push.
      <br>• <b>Run-out</b> — the whole run-out, best mid-to-last.
      <br>Window reasons then read e.g. “Your run-out spot: mid run-out”. Light, solunar, moon, weather and water temperature are unchanged, so a run-out spot at dusk still beats one at midday. Untyped (general) spots and the built-in landmarks use the general model. <b>My spots today</b> ranks all your typed spots by their best window for the selected day, and the catch log records each spot’s type and the stage you fished so you can check it against your own bites.</p></details>
    <details><summary>Solunar (≈16%)</summary>""")
mj_css+="""
.sttag{display:inline-block;min-width:22px;padding:0 4px;border-radius:6px;color:#111;font-weight:800;font-size:.68rem;line-height:1.35;text-align:center;vertical-align:1px}
.mys{display:flex;flex-direction:column;gap:6px}
.myrow{display:flex;align-items:center;gap:8px;background:var(--panel2,#14302f);border:1px solid #25464b;border-radius:10px;padding:6px 8px;cursor:pointer}
.myrow.on{border-color:#7ff0c8}
.myrk{color:#9db5b1;font-weight:700;width:14px;text-align:center}
.mysc{font-size:1.35rem;font-weight:800;width:38px;text-align:center}
.myb{flex:1;min-width:0;font-size:.85rem}.myb>div{overflow:hidden;text-overflow:ellipsis}
"""
# ---------- weather v2: drizzle & storm triggers, fresh-flow, weight rebalance (light 28 / tide 38 / sol 14 / moon 5 / wx 15) ----------
WX_CORE=open(f'{SRC}/wx/core.js').read(); WX_UI=open(f'{SRC}/wx/ui.js').read()
_a=mj_core.index("function weatherFactor(w){"); _e="  return{v:clamp(v),notes};}\n"; _b=mj_core.index(_e,_a)+len(_e)
mj_core=mj_core[:_a]+WX_CORE+"\n"+mj_core[_b:]
assert 'const STYPES=' in mj_core
mj_core=patch(mj_core,"  if(alt>0&&cloud!=null){v=Math.min(1,v+(1-v)*0.35*cloud/100);if(cloud>75)label+=' (overcast)';}",
 "  if(alt>0&&cloud!=null){v=Math.min(1,v+(1-v)*0.45*cloud/100);if(cloud>75)label+=' (overcast)';}\n  if(alt>0){const dz=drizzleOf(rain,code);if(dz>0.2){v=Math.min(1,v+(1-v)*0.25*dz);label+=' (drizzle dims the light)';}}")
mj_core=patch(mj_core,"function lightFactor(alt,cloud){","function lightFactor(alt,cloud,rain,code){")
mj_core=patch(mj_core,"const W={light:0.30,tide:0.40,sol:0.16,moon:0.05,wx:0.09};","const W={light:0.28,tide:0.38,sol:0.14,moon:0.05,wx:0.15};")
mj_core=patch(mj_core,"stepMin=15,weekRange,runIn,spotType}=opts;","stepMin=15,weekRange,runIn,spotType,fresh}=opts;")
mj_core=patch(mj_core,"const L=lightFactor(sunAlt(t,lat,lng),wx?wx.cloud:null);","const L=lightFactor(sunAlt(t,lat,lng),wx?wx.cloud:null,wx?wx.rain:null,wx?wx.code:null);")
mj_core=patch(mj_core,"    const WX=weatherFactor(wx);","    const WX=weatherFactor(wx,freshAdj(fresh,t));")
mj_core=patch(mj_core,"  const rating=Math.round(top4.reduce((a,b)=>a+b.score,0)/top4.length);\n",
 """  const rating=Math.round(top4.reduce((a,b)=>a+b.score,0)/top4.length);
  /* weather triggers of the day (stats + 7-day badges) */
  const wxDay={drizzleH:0,drizzleFirst:null,storm:null,lightning:[],heavyH:0,fresh:freshAdj(fresh,t0+12*3600e3)};
  for(const p of pts){const X=p.WX;if(X.dz>0.5){wxDay.drizzleH+=stepMin/60;if(wxDay.drizzleFirst==null)wxDay.drizzleFirst=p.t;}
    if(X.lightning&&!wxDay.lightning.length||X.lightning&&p.t-wxDay.lightning[wxDay.lightning.length-1]>3600e3)wxDay.lightning.push(p.t);
    if(X.heavy)wxDay.heavyH+=stepMin/60;
    const st=p.wx&&p.wx.storm;if(st&&st.v>=0.15){const tp=p.t+st.inH*3600e3;if(tp<t1&&(!wxDay.storm||st.v>wxDay.storm.v))wxDay.storm={v:st.v,t:tp,cape:st.cape,li:st.li,pp:st.pp};}}
  wxDay.heavyH=Math.round(wxDay.heavyH);
""")
mj_core=patch(mj_core,"rating,range,dayExt:","rating,wxDay,range,dayExt:")
mj_core=patch(mj_core,"root.MJ={","root.MJ={makeWxFn,stormPot,drizzleOf,freshAdj,floodState,floodAdj,W,")
# ---------- Calendar tab: computeDay may take precomputed sun/moon events (coarse month scan only; Bite times never passes them) ----------
mj_core=patch(mj_core,"  const ev=sunMoonEvents(t0-4*3600e3,t1+4*3600e3,lat,lng);","  const ev=opts.ev||sunMoonEvents(t0-4*3600e3,t1+4*3600e3,lat,lng);")
mj_ui=patch(mj_ui,"FT.biteSetLoc=setLoc;","FT.biteSetLoc=setLoc;FT.biteGo=(l,v)=>{if(v&&$('date').value!==v){$('date').value=v;FT.setDate(v,'bite');}setLoc(l);};")
# forecast fields (all verified on api.open-meteo.com/v1/forecast; missing ones are ignored by makeWxFn)
mj_ui=patch(mj_ui,"hourly=pressure_msl,wind_speed_10m,cloud_cover,precipitation,relative_humidity_2m,temperature_2m,weather_code&",
 "hourly=pressure_msl,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,relative_humidity_2m,temperature_2m,weather_code,cape,lifted_index&")
_a=mj_ui.index("    wxFn=t=>{const p=P(t);if(p==null)return null;"); _b=mj_ui.index("stormAhead:storm};};",_a)+len("stormAhead:storm};};")
mj_ui=mj_ui[:_a]+"    wxFn=MJ.makeWxFn(tt,h);void P,Wd,C,R,RH,T,codeAt;"+mj_ui[_b:]
mj_ui=patch(mj_ui,"  // week\n","  const fresh=BZ!=null?await getFresh().catch(()=>null):null;\n  // week\n")
mj_ui=patch(mj_ui,"weekRange,runIn,spotType:SPT})","weekRange,runIn,spotType:SPT,fresh})")
mj_ui=patch(mj_ui,"hasTide:!!tideFn,spotType:SPT,wxFn,sstFn,","hasTide:!!tideFn,spotType:SPT,wxFn,sstFn,fresh,")
mj_ui=patch(mj_ui,"FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n","FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n"+WX_UI+"\n")
mj_ui=patch(mj_ui,"    ['🧭 Pressure',pr],","    ['⛈️ Storm / drizzle',wxDayTxt(d,false)||'none forecast'],\n    ['🧭 Pressure',pr],")
mj_ui=patch(mj_ui,'<div class="stars">${stars(d.rating)}</div>','<div class="stars">${stars(d.rating)}</div>${wxDayTxt(d,true)?`<div class="ds wxb">${wxDayTxt(d,true)}</div>`:""}')
mj_main=patch(mj_main,"<summary>Low light (≈30% weight)</summary>","<summary>Low light (≈28% weight)</summary>")
mj_main=patch(mj_main,"heavy cloud cover lifts daytime scores.","heavy cloud cover — and drizzle or light rain — lifts daytime scores (it dims the light like dusk).")
mj_main=patch(mj_main,"<summary>Tide (≈40%) — run-in start is the top driver</summary>","<summary>Tide (≈38%) — run-in start is the top driver</summary>")
mj_main=patch(mj_main,"<summary>Solunar (≈16%)</summary>","<summary>Solunar (≈14%)</summary>")
mj_main=patch(mj_main,"""    <details><summary>Weather (≈9%)</summary><p>Falling barometer and the build-up to storms boost the score; warm humid conditions help; a rapidly rising barometer, strong wind (&gt;25 km/h) and heavy rain are light penalties.</p></details>""",
"""    <details><summary>Weather (≈15%) — drizzle &amp; storm build-up are triggers</summary><p><b>Triggers (boost):</b> <b>drizzle / light rain</b> (~0.1–2 mm/h, or a drizzle forecast) — also counts as low light in the daytime; <b>storm build-up</b> — from the Open-Meteo forecast’s thunderstorm/shower codes, CAPE (atmospheric instability), lifted index and rain probability, the boost runs from ~3 h <i>before</i> the storm/instability peak to its onset, stronger with a <b>falling barometer</b> and <b>warm humid air</b>; a falling barometer on its own; overcast skies. Combined with a run-in start in low light these give the highest scores of all.</p><p><b>Penalties only for:</b> very heavy rain (&gt; ~8 mm/h), strong wind (&gt; 30 km/h) and the first few days of dirty water after a <b>big flood</b> (modest — see the flood cycle below). <b>Lightning at your spot</b> isn’t scored down much but is flagged <b>⚠</b> — get off the water. Rising barometer is now neutral. Offline, the last cached forecast is used.</p></details>""")
mj_css+="\n.wxb{color:#ffd27a}\n"
mj_main=patch(mj_main,"    <details><summary>Solunar (≈14%)</summary>","""    <details><summary>Flood cycle (fresh-flow gauge)</summary><p>Local rule: <b>about 1 to 2 weeks after a flood, even with the river still running, fishes well for jacks — and light floods or runoff are also very good.</b> The app reads the system’s fresh-flow gauge above the tide (Mimdale on Baffle Ck; the BoM upstream gauge on other systems — archive + BoM 7-day tables) and finds the latest rise. A <b>big flood</b> = peak at/above the BoM <i>moderate</i> flood level (or a ≥3 m rise where BoM has no classes); anything smaller but clearly above base flow is a <b>light flood / runoff</b>.
      <br>• <b>Light flood / runoff:</b> a boost from the onset, peaking a few days in and lasting ~10–14 days.
      <br>• <b>Big flood:</b> ~3–5 days after the peak a modest penalty (dirty water, debris), then a <b>strong boost from ~day 7 to day 14</b> (the prime post-flood window) even if the river is still high, tapering by ~day 21.
      <br>It is added on top of the weather/conditions score and shows as a 🌊 chip in the day stats, 7-day outlook and window reasons; the Gauges tab flags the prime window. If the gauge history is too short to see a flood 1–3 weeks back, the app says so.</p></details>
    <details><summary>Solunar (≈14%)</summary>""")
# ---------- multi-system patches: Tides UI (works on window.BT = Baffle model or a generic system model) ----------
bt_ui=patch(bt_ui,"const st={km:+(localStorage.getItem('bt_km')||35.25),gps:null,landmark:null};",
 "const GEN=!!B.generic,FK=k=>window.FT.k(k);\nconst st={km:+(localStorage.getItem(FK('bt_km'))||(GEN?B.DEFKM:35.25)),line:GEN?(localStorage.getItem(FK('bt_line'))||'M'):null,gps:null,landmark:null};\nif(GEN&&!B.LINES.some(l=>l.id===st.line))st.line='M';")
bt_ui=patch(bt_ui,"$('hoff').value=localStorage.getItem('bt_hoff')||0;$('badj').value=localStorage.getItem('bt_badj')||0;","$('hoff').value=localStorage.getItem(FK('bt_hoff'))||0;$('badj').value=localStorage.getItem(FK('bt_badj'))||0;")
bt_ui=patch(bt_ui,"function opts(){return{hoff:+$('hoff').value||0,badj:+$('badj').value||0,corr:corrections()};}","function opts(){const o={hoff:+$('hoff').value||0,badj:+$('badj').value||0,corr:corrections()};if(GEN)o.line=st.line;else if(st.bline)o.line=st.bline;return o;}")
bt_ui=patch(bt_ui,"let bench=JSON.parse(localStorage.getItem('bt_bench')||'[]');\nfunction saveBench(){localStorage.setItem('bt_bench',JSON.stringify(bench));}","let bench=JSON.parse(localStorage.getItem(FK('bt_bench'))||'[]');\nfunction saveBench(){localStorage.setItem(FK('bt_bench'),JSON.stringify(bench));}")
bt_ui=patch(bt_ui,"function corrections(){return bench.filter(b=>b.applied&&b.diff!=null).map(b=>({km:b.km,","function corrections(){return bench.filter(b=>b.applied&&b.diff!=null).map(b=>({...(GEN?{line:b.line||'M'}:{}),km:b.km,")
bt_ui=patch(bt_ui,"corr:useCorr?corrections().filter(c=>!(c.km===b.km&&b.applied)):null};","corr:useCorr?corrections().filter(c=>!(c.km===b.km&&b.applied)):null};if(GEN)o.line=b.line||'M';")
bt_ui=patch(bt_ui,"No observations yet. On your next trip, log high/low turns and gauge-board readings — especially at Essendean Bridge, Wartburg, Rocky Point and the mouth.","'+(GEN?`No observations yet for ${esc(FT.SYSNAME)}. Log a few high/low turns (or gauge-board readings) at a ramp or bridge and tick <b>apply</b> — that calibrates this system (${FT.SYSINFO.conf==='C'?'currently an uncalibrated generic model':'refines the offsets'}).`:'No observations yet. On your next trip, log high/low turns and gauge-board readings — especially at Essendean Bridge, Wartburg, Rocky Point and the mouth.')+'")
bt_ui=patch(bt_ui,"<span class=\"mut\">${b.km.toFixed(2)} km</span>","<span class=\"mut\">${b.km.toFixed(2)} km${GEN&&b.line&&b.line!=='M'?' '+esc(B.lineName(b.line)):''}</span>")
bt_ui=patch(bt_ui,"const add=(km,place,lat,lon)=>{","const add=(km,place,lat,lon,line)=>{")
bt_ui=patch(bt_ui,"note:$('bNote').value,applied:false});","note:$('bNote').value,applied:false,...(GEN?{line:line||'M'}:line?{line}:{})});")
bt_ui=patch(bt_ui,"add(s.km,`GPS (${s.line}, ${Math.round(s.offKm*1000)} m off line)`,p.coords.latitude,p.coords.longitude);","add(s.km,`GPS (${s.line}, ${Math.round(s.offKm*1000)} m off line)`,p.coords.latitude,p.coords.longitude,s.lineId);")
bt_ui=patch(bt_ui,"else{const pt=B.pointAtKm(st.km);add(st.km,st.landmark||('km '+st.km.toFixed(2)),pt[0],pt[1]);}","else{const pt=GEN?B.pointOnLine(st.km,st.line):B.pointAtKm(st.km);add(st.km,st.landmark||('km '+st.km.toFixed(2)),pt[0],pt[1],GEN?st.line:st.bline);}")
bt_ui=patch(bt_ui,"const CSVH=['id','logged_aest','obs_time_aest','km','place','lat','lon','type','value_m','note','pred_time_aest','pred_value_m_ahd','pred_minus_obs','applied'];","const CSVH=['id','logged_aest','obs_time_aest','km','place','lat','lon','type','value_m','note','pred_time_aest','pred_value_m_ahd','pred_minus_obs','applied'].concat(GEN?['line','system']:[]);")
bt_ui=patch(bt_ui,"b.applied?1:0].map(q).join(',')));","b.applied?1:0].concat(GEN?[b.line||'M',FT.SYS]:[]).map(q).join(',')));")
bt_ui=patch(bt_ui,"a.download='baffle-benchmarks-'+","a.download=(GEN?FT.SYS:'baffle')+'-benchmarks-'+")
bt_ui=patch(bt_ui,"note:r[ix('note')],applied:r[ix('applied')]==='1'});n++;}","note:r[ix('note')],applied:r[ix('applied')]==='1',...(GEN?{line:ix('line')>=0&&B.LINES.some(l=>l.id===r[ix('line')])?r[ix('line')]:'M'}:{})});n++;}")
bt_ui=patch(bt_ui,"const km=st.km;localStorage.setItem('bt_km',km);localStorage.setItem('bt_hoff',$('hoff').value);localStorage.setItem('bt_badj',$('badj').value);",
 "const km=st.km;localStorage.setItem(FK('bt_km'),km);localStorage.setItem(FK('bt_hoff'),$('hoff').value);localStorage.setItem(FK('bt_badj'),$('badj').value);if(GEN)localStorage.setItem(FK('bt_line'),st.line);")
bt_ui=patch(bt_ui,"const pt=B.pointAtKm(Math.min(km,B.MAXKM));","const pt=GEN?B.pointOnLine(km,st.line):B.pointAtKm(Math.min(km,B.MAXKM));")
bt_ui=patch(bt_ui,"${km.toFixed(2)} km up Baffle Creek from the mouth","${GEN?(st.line==='M'?(B.kmBoth?km.toFixed(2)+' km from the south entrance (Bribie bridge) · '+B.kmBoth(km,'M').n.toFixed(2)+' km from the Caloundra bar':km.toFixed(2)+' km up '+esc(FT.SYSNAME)+' from the mouth'):km.toFixed(2)+' km from the '+esc(FT.SYSNAME)+' mouth, on '+esc(B.lineName(st.line))+' (joins at km '+B.LINES.find(l=>l.id===st.line).j.toFixed(1)+')')+(FT.twoNote?FT.twoNote(km,st.line):''):km.toFixed(2)+' km up Baffle Creek from the mouth'}")
bt_ui=patch(bt_ui,"if(cal.beyond)warn+='<div class=\"notice\">Above Essendean Bridge","if(GEN&&cal.beyond)warn+='<div class=\"notice\">Above '+esc(cal.nodeB.name)+' (the last model node). Values held there — real timing likely later and range smaller or nil. Great place to benchmark.</div>';\n  else if(GEN&&cal.generic)warn+='<div class=\"notice\">⚠ <b>Uncalibrated — benchmark me.</b> No tide gauge or MSQ tide place covers this reach; lag and height are a generic estimate (median QLD lag growth), so allow ±'+Math.round(cal.hwU)+' min on highs and ±'+Math.round(cal.lwU)+' min on lows. Log a high or low turn here to calibrate it.</div>';\n  else if(cal.beyond)warn+='<div class=\"notice\">Above Essendean Bridge")
bt_ui=patch(bt_ui,"<small>${off.length?'Official MSQ Bundaberg: '","<small>${GEN?'Base port '+esc(B.SYS.port.name)+' (MSQ harmonics)'+(cal.trunc?' · lows here: pool level':''):off.length?'Official MSQ Bundaberg: '")
bt_ui=patch(bt_ui,"B.LANDMARKS.map((l,i)=>{const p=B.predictAt(l.km,t0,t1,o);","B.LANDMARKS.map((l,i)=>{const lo=Object.assign({},o,{line:GEN?(l.line||'M'):l.line});const p=B.predictAt(l.km,t0,t1,lo);")
bt_ui=patch(bt_ui,"B.runInStarts(l.km,t0,t1,o)","B.runInStarts(l.km,t0,t1,lo)")
bt_ui=patch(bt_ui,"<tr class=\"click${Math.abs(l.km-km)<0.01?' sel':''}\"","<tr class=\"click${Math.abs(l.km-km)<0.01&&(!GEN||(l.line||'M')===st.line)?' sel':''}\"")
bt_ui=patch(bt_ui,"const l=B.LANDMARKS[+tr.dataset.i];selectKm(l.km,l.name);","const l=B.LANDMARKS[+tr.dataset.i];selectKm(l.km,l.name,l.line);")
bt_ui=patch(bt_ui,"E=B.predictAt(35.25,t0-6,t1+6,o);","E=GEN?B.predictAt(B.REFKM,t0-6,t1+6,Object.assign({},o,{line:'M'})):B.predictAt(35.25,t0-6,t1+6,Object.assign({},o,{line:'B'}));")
bt_ui=patch(bt_ui,"function selectKm(km,name){st.km=Math.max(0,Math.min(B.MAXKM,km));st.landmark=name||null;st.gps=null;$('km').value=st.km;const i=B.LANDMARKS.findIndex(l=>l.name===name);",
 """function syncLine(){if(!GEN)return;const L=B.LINES.find(l=>l.id===st.line)||B.LINES[0];st.line=L.id;$('km').min=L.id==='M'?0:+L.j.toFixed(2);$('km').max=+B.lineMax(L.id).toFixed(2);$('km').step=0.05;
  const s=document.getElementById('bt-line');if(s){if(!s.options.length)s.innerHTML=B.LINES.map(l=>`<option value="${l.id}">${esc(l.name)}${l.id==='M'?' (main)':' — joins km '+l.j.toFixed(1)}</option>`).join('');s.value=L.id;}
  const ml=document.getElementById('bt-kmMaxLbl');if(ml)ml.textContent=B.lineMax(L.id).toFixed(1)+' km';}
function selectKm(km,name,line){if(GEN){st.line=line||st.line||'M';syncLine();}else st.bline=line||null;st.km=Math.max(GEN&&st.line!=='M'?B.LINES.find(l=>l.id===st.line).j:0,Math.min(GEN?B.lineMax(st.line):B.MAXKM,km));st.landmark=name||null;st.gps=null;$('km').value=st.km;const i=B.LANDMARKS.findIndex(l=>l.name===name&&(!GEN||(l.line||'M')===st.line));""")
bt_ui=patch(bt_ui,"const l=B.LANDMARKS[+$('lm').value];selectKm(l.km,l.name);};","const l=B.LANDMARKS[+$('lm').value];selectKm(l.km,l.name,l.line);};\nif(GEN&&document.getElementById('bt-line'))document.getElementById('bt-line').onchange=e=>{const L=B.LINES.find(l=>l.id===e.target.value);if(!L)return;st.line=L.id;syncLine();st.km=L.id==='M'?Math.min(st.km,B.lineMax('M')):Math.max(L.j,Math.min(B.lineMax(L.id),st.km<=L.j?L.j+Math.min(1,(B.lineMax(L.id)-L.j)/2):st.km));st.landmark=null;st.gps=null;$('km').value=st.km;$('lm').value='';render();};")
bt_ui=patch(bt_ui,"const s=B.snap(p.coords.latitude,p.coords.longitude);st.km=Math.min(B.MAXKM,s.km);","const s=B.snap(p.coords.latitude,p.coords.longitude);if(GEN){st.line=s.lineId;syncLine();}else st.bline=s.lineId;st.km=Math.min(GEN?B.lineMax(s.lineId):B.MAXKM,s.km);if(s.offKm>1.5&&window.FT.suggestSystem)window.FT.suggestSystem(p.coords.latitude,p.coords.longitude);")
bt_ui=patch(bt_ui,"$('live').onclick=async()=>{","if($('live'))$('live').onclick=async()=>{")
bt_ui=patch(bt_ui,"$('nodesTbl').innerHTML='<table>","if(GEN){const fm=m=>(m<0?'−':'+')+Math.floor(Math.abs(m)/60)+':'+String(Math.round(Math.abs(m)%60)).padStart(2,'0');const K={bom:'gauge',gaugefit:'gauge',port:'base port',msq:'MSQ',mouth:'mouth',junction:'junction',generic:'generic',limit:'limit'};\n  $('nodesTbl').innerHTML='<div class=\"tw\"><table><tr><th>Channel</th><th>km</th><th>Node</th><th>HW lag</th><th>LW lag</th><th>Type</th></tr>'+B.LINES.map(L=>B.NBY[L.id].filter(n=>L.id==='M'||n.km>L.j-1e-6).map(n=>`<tr><td class=\"mut\">${esc(L.id==='M'?'main':L.name)}</td><td>${n.km.toFixed(1)}</td><td>${esc(n.name)}</td><td>${fm(n.hwLag)} ±${Math.round(n.hwU)}′</td><td>${fm(n.lwLag)} ±${Math.round(n.lwU)}′${n.trunc?' <span class=\"mut\">pool</span>':''}</td><td class=\"mut\">${esc(K[n.kind]||n.kind||'')}</td></tr>`).join('')).join('')+'</table></div><p class=\"mut\">Lags are after the '+esc(B.SYS.port.name)+' high/low.</p>';}\nelse $('nodesTbl').innerHTML='<table>")
bt_ui=patch(bt_ui,"const i0=B.LANDMARKS.findIndex(l=>Math.abs(l.km-st.km)<0.01);","syncLine();if(GEN)$('km').value=st.km;\nconst i0=B.LANDMARKS.findIndex(l=>Math.abs(l.km-st.km)<0.01&&(!GEN||(l.line||'M')===st.line));")
# --- shallow crossings (cross/cross.js): Tides graph shading + threshold line + 7-day list ---
bt_ui=patch(bt_ui,"mn=Math.floor(mn*4)/4;mx=Math.ceil(mx*4)/4;","if(window.FT&&FT.cross){const xr=FT.cross.tideRange(st.km,o);if(xr){mn=Math.min(mn,xr.lo-0.1);mx=Math.max(mx,xr.hi+0.1);}}mn=Math.floor(mn*4)/4;mx=Math.ceil(mx*4)/4;")
bt_ui=patch(bt_ui,"  svg.innerHTML=s;}\n","  if(window.FT&&FT.cross)try{s+=FT.cross.tideSvg({x,y,t0,t1,mn,mx,L,R,T,W,ph,km:st.km,o});}catch(e){console.error('crossings',e);}\n  svg.innerHTML=s;}\n")
bt_ui=patch(bt_ui,"  drawChart(P,t0,t1,o);\n","  drawChart(P,t0,t1,o);if(window.FT&&FT.cross)try{FT.cross.tideList(st.km,o,t0);}catch(e){console.error('crossings',e);}\n")

exec(open(f'{SRC}/sides/build_patches.py').read())
exec(open(f'{SRC}/lure/build_patches.py').read())
exec(open(f'{SRC}/adj/build_patches.py').read())
DC_JS=open(f'{SRC}/declutter/dc.js').read();DC_CSS=open(f'{SRC}/declutter/dc.css').read()
# ---------- namespace IDs ----------
def ids(html): return set(re.findall(r'\bid="([A-Za-z0-9_-]+)"',html))
def ns(html,css,js,pre):
    I=ids(html)
    html=re.sub(r'\bid="([A-Za-z0-9_-]+)"',lambda m:f'id="{pre}{m.group(1)}"' if m.group(1) in I else m.group(0),html)
    js=re.sub(r"\$\('([A-Za-z0-9_-]+)'\)",lambda m:f"$('{pre}{m.group(1)}')" if m.group(1) in I else m.group(0),js)
    css=re.sub(r'#([A-Za-z][A-Za-z0-9_-]*)\b',lambda m:f'#{pre}{m.group(1)}' if m.group(1) in I else m.group(0),css)
    return html,css,js
JS_IDS_MJ={'openBaffle'}  # created dynamically, left un-prefixed (unique)
mj_main,mj_css,mj_ui=ns(mj_main,mj_css,mj_ui,'mj-')
bt_main,bt_css,bt_ui=ns(bt_main,bt_css,bt_ui,'bt-')
assert "$('date')" not in mj_ui and "$('date')" not in bt_ui
# Baffle CSS: drop header rules (combined header below)
bt_css='\n'.join(l for l in bt_css.split('\n') if not l.startswith('header'))
mj_css='\n'.join(l for l in mj_css.split('\n') if not l.startswith('header'))

RUNIN_JS=open(f'{SRC}/runin.js').read()
SIDES_JS=open(f'{SRC}/sides/sides.js').read()
SPOTS_JS=open(f'{SRC}/map/spots.js').read();CROSS_JS=open(f'{SRC}/cross/cross.js').read();CROSS_CSS=open(f'{SRC}/cross/cross.css').read()
M_CSS=open(f'{SRC}/map/tab.css').read();M_HTML=open(f'{SRC}/map/tab.html').read();M_JS=open(f'{SRC}/map/tab.js').read()
C_SCHEMA=json.load(open(f'{SRC}/catchlog/schema.json'))
C_CSS=open(f'{SRC}/catchlog/tab.css').read();C_HTML=open(f'{SRC}/catchlog/tab.html').read()
C_JS=open(f'{SRC}/catchlog/tab.js').read();assert '/*SCHEMA*/null' in C_JS;C_JS=C_JS.replace('/*SCHEMA*/null',json.dumps(C_SCHEMA,ensure_ascii=False,separators=(',',':')))
G_CSS=open(f'{SRC}/gauges/tab.css').read();G_HTML=open(f'{SRC}/gauges/tab.html').read();G_JS=open(f'{SRC}/gauges/tab.js').read()
GSP_JS=open(f'{SRC}/gauges/gspots.js').read()
GS_JS=open(f'{SRC}/gauges/gen.js').read()
CAL_CSS=open(f'{SRC}/cal/tab.css').read();CAL_HTML=open(f'{SRC}/cal/tab.html').read();CAL_JS=open(f'{SRC}/cal/tab.js').read();CALC_JS=open(f'{SRC}/cal/calc.js').read()
PLAN_CSS=open(f'{SRC}/plan/tab.css').read();PLAN_HTML=open(f'{SRC}/plan/tab.html').read();PLAN_JS=open(f'{SRC}/plan/tab.js').read()
# ---------- multi-system: river-system index (generated data, versioned in tools/multisys/out; see tools/multisys/README.md) ----------
SYSOUT=f'{MSOUT}/systems'
SYSX=json.load(open(f'{SYSOUT}/index.json'))
# Maroochy main line is extended up the South Maroochy to the Yandina rock ford (James Low Bridge) by
# tools/multisys/build/ext_maroochy_yandina.py — re-run it after any s5_build.py rebuild of the systems.
_mr=next((x for x in SYSX['systems'] if x.get('id')=='maroochy-river'),None)
if _mr is not None and _mr.get('km',0)<28.5: raise SystemExit('Maroochy Yandina extension missing: run multisys/build/ext_maroochy_yandina.py')
SYSIDX=[{k:x[k] for k in ('id','name','area','conf','port','km','g','mouth','bbox')} for x in SYSX['systems']]
assert any(x['id']=='baffle' for x in SYSIDX)
BOOT_JS=open(f'{SRC}/systems/boot.js').read();assert '/*SYSIDX*/[]' in BOOT_JS
BOOT_JS=BOOT_JS.replace('/*SYSIDX*/[]',json.dumps(SYSIDX,ensure_ascii=False,separators=(',',':')))
ENGINE_JS=open(f'{SRC}/systems/engine.js').read();SYSUI_JS=open(f'{SRC}/systems/sysui.js').read()
LOADER_JS='''(function(){const FT=window.FT;
function run(){for(const s of [...document.querySelectorAll('script[type="text/ft-deferred"]')]){const n=document.createElement('script');n.text=s.textContent;if(s.id){const i=s.id;s.removeAttribute('id');n.id=i;}s.replaceWith(n);}}
if(FT.SYS==='baffle'){run();return;}
const b=document.createElement('div');b.className='notice';b.id='sysLoading';b.innerHTML='<span class="spin"></span> Loading '+FT.SYSNAME+'…';document.querySelector('main').prepend(b);
FT.fetchSys(FT.SYS).then(J=>{window.BT=FT.makeSystemBT(J);b.remove();run();}).catch(e=>{console.error(e);
  b.className='notice err';b.innerHTML='⚠ Couldn’t load '+FT.SYSNAME+' ('+String(e.message||e).replace(/[<>&]/g,'')+'). Offline and not saved on this phone? <button class="sm pri" id="sysBack">Back to Baffle Creek</button>';
  document.getElementById('sysBack').onclick=()=>FT.switchSystem('baffle');
  const t=(location.hash||'').slice(1);document.querySelectorAll('.tab').forEach(x=>x.hidden=x.id!=='tab-'+(t||'bite'));});
})();'''
HEAD=f'''<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b3b3a">
<title>Mac's Jacks — mangrove jack bite times &amp; Baffle Creek tides</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png?v={VER}"><link rel="icon" type="image/png" sizes="16x16" href="icons/icon-16.png?v={VER}"><link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png?v={VER}">
<link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180.png?v={VER}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mac's Jacks">
<meta name="app-version" content="{VER}">
<style>
{mj_css}
/* ---- Baffle tides ---- */
{bt_css}
/* ---- combined shell ---- */
body{{padding-bottom:env(safe-area-inset-bottom)}}
header{{background:linear-gradient(135deg,#0b3b3a,#1b2b40 60%,#3b1f16);padding:max(14px,env(safe-area-inset-top)) 16px 0}}
header h1{{margin:0;font-size:1.3rem;display:flex;align-items:center;gap:.45rem}} header h1 img.logo{{width:34px;height:34px;border-radius:8px;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.15)}} header h1 span{{color:var(--acc)}}
header p{{margin:2px 0 8px;color:var(--mut);font-size:.82rem}}
nav.tabs{{display:flex;gap:4px;max-width:1000px;margin:0 auto}}
nav.tabs a{{flex:1;text-align:center;padding:10px 6px;border-radius:12px 12px 0 0;color:var(--mut);text-decoration:none;font-weight:600;background:#0d1f2288}}
nav.tabs a.on{{background:var(--bg);color:var(--ink);box-shadow:inset 0 3px 0 var(--acc)}}
nav.tabs a[data-tab=baffle].on{{box-shadow:inset 0 3px 0 var(--tide)}}
nav.tabs a[data-tab=gauges].on{{box-shadow:inset 0 3px 0 #e5484d}}
@media(max-width:520px){{nav.tabs a{{font-size:.8rem;padding:9px 2px;line-height:1.2}}}}
@media(max-width:380px){{nav.tabs a{{font-size:.72rem}}}}
@media(max-width:460px){{nav.tabs{{gap:2px}} nav.tabs a{{font-size:.74rem;padding:9px 0;letter-spacing:-.2px;white-space:nowrap}}}}
@media(max-width:360px){{nav.tabs a{{font-size:.66rem}}}}
{G_CSS}
{C_CSS}
{M_CSS}
{CAL_CSS}
{PLAN_CSS}
{LURE_CSS}
{DC_CSS}
{CROSS_CSS}
.tab[hidden]{{display:none}}
.sysbar{{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:1000px;margin:0 auto 8px;font-size:.85rem}}
.sysbar label{{flex:1 1 110px;min-width:0;display:flex;align-items:center;gap:4px}}
.sysbar select{{flex:1;min-width:0;width:100%;max-width:100%;padding:6px 8px;border-radius:10px;background:#0d1f22;color:var(--ink);border:1px solid #2b5157;font-size:.9rem}}
.sysbar button{{white-space:nowrap;padding:6px 9px}}
.sysconf{{display:inline-block;min-width:1.6em;text-align:center;font-weight:700;border-radius:7px;padding:2px 6px;font-size:.8rem;color:#081214}}
.fed{{margin-top:4px;font-size:.86rem;line-height:1.35}} .sysconf.cA{{background:#57d18a}} .sysconf.cB{{background:#ffd38a}} .sysconf.cC{{background:#ff9b8a}}
.sysmsg{{flex-basis:100%;color:var(--mut);font-size:.82rem}} .sysmsg:empty{{display:none}}
.sysmsg button{{margin-left:4px}}
.src{{margin-top:8px;font-size:.84rem;background:#12303d;border:1px solid #245a72;color:#cfeeff;border-radius:10px;padding:7px 10px}}
.src:empty{{display:none}}
input:disabled{{opacity:.4}}
</style>
</head>
<body>
<header>
  <h1><img class="logo" src="icons/icon-64.png" srcset="icons/icon-64.png 1x, icons/icon-128.png 2x" alt="" width="34" height="34"><span>Mac's Jacks</span></h1>
  <p>Mangrove jack bite times · Baffle Creek tides (mouth → Essendean) · Bundaberg region</p>
  <nav class="tabs"><a href="#bite" data-tab="bite">🎣 <span class="tl">Bite times</span><span class="ts">Bites</span></a><a href="#baffle" data-tab="baffle">🌊 <span class="tl">Tides</span><span class="ts">Tides</span></a><a href="#map" data-tab="map">🗺 <span class="tl">Map</span><span class="ts">Map</span></a><a href="#gauges" data-tab="gauges">📡 <span class="tl">Gauges</span><span class="ts">Gauges</span></a><a href="#cal" data-tab="cal">📅 <span class="tl">Calendar</span><span class="ts">Cal</span></a><a href="#log" data-tab="log">📝 <span class="tl">Catch log</span><span class="ts">Log</span></a></nav>
</header>
'''
SHELL='''<script>
/* Mac's Jacks shell: tabs, shared date, cross-tab hooks */
window.FT=(function(){const FT={};
FT.onTab=[];
FT.showTab=function(t){if(!['bite','baffle','map','gauges','cal','log'].includes(t))t='bite';
  document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!=='tab-'+t);
  document.querySelectorAll('nav.tabs a').forEach(a=>a.classList.toggle('on',a.dataset.tab===t));
  if(location.hash!=='#'+t)history.replaceState(null,'','#'+t);
  try{localStorage.setItem('ft_tab',t);}catch(e){}document.body.dataset.tab=t;window.scrollTo(0,0);FT.onTab.forEach(f=>{try{f(t)}catch(e){console.error(e)}});};
FT.setDate=function(v,from){if(!v)return;if(from!=='bite'&&FT.biteSetDate)FT.biteSetDate(v);if(from!=='baffle'&&FT.baffleSetDate)FT.baffleSetDate(v);};
addEventListener('hashchange',()=>FT.showTab(location.hash.slice(1)));
return FT;})();
</script>
'''
BODY=f'''<main>
<div class="tab" id="tab-bite">
{mj_main}
</div>
<div class="tab" id="tab-baffle" hidden>
{bt_main}
</div>
<div class="tab" id="tab-map" hidden>
{M_HTML}
</div>
<div class="tab" id="tab-gauges" hidden>
{G_HTML}
</div>
<div class="tab" id="tab-cal" hidden>
{CAL_HTML}
</div>
<div class="tab" id="tab-log" hidden>
{C_HTML}
</div>
</main>
{PLAN_HTML}
<footer>{mj_foot}<br>{bt_foot}<br><span class="mut">Mac's Jacks build {VER}</span></footer>
{SHELL}
<script id="ft-boot">{BOOT_JS}</script>
<script id="mj-core">{mj_core}</script>
<script id="bt-data">{bt_data}</script>
<script id="bt-core">{bt_core}</script>
<script id="bt-adj">{ADJ_JS}</script>
<script id="bt-runin">{RUNIN_JS}</script>
<script id="bt-sides">{SIDES_JS}</script>
<script id="ft-lure">{LURE_CORE}</script>
<script id="ft-engine">{ENGINE_JS}</script>
<script id="ft-calc">{CALC_JS}</script>
<script type="text/ft-deferred" id="ft-sysui">{SYSUI_JS}</script>
<script type="text/ft-deferred" id="ft-spots">{SPOTS_JS}</script>
<script type="text/ft-deferred" id="ft-cross">{CROSS_JS}</script>
<script type="text/ft-deferred">{bt_ui}</script>
<script type="text/ft-deferred">{mj_ui}</script>
<script type="text/ft-deferred" id="ft-gspots">{GSP_JS}</script>
<script type="text/ft-deferred">if(!window.BT.generic){{{G_JS}}}</script>
<script type="text/ft-deferred">{GS_JS}</script>
<script type="text/ft-deferred">{C_JS}</script>
<script type="text/ft-deferred">{M_JS}</script>
<script type="text/ft-deferred">{CAL_JS}</script>
<script type="text/ft-deferred">{PLAN_JS}</script>
<script type="text/ft-deferred" id="ft-dc">{DC_JS}</script>
<script type="text/ft-deferred">
FT.showTab((location.hash||'').slice(1)||(function(){{try{{return localStorage.getItem('ft_tab')}}catch(e){{return null}}}})()||'bite');
document.body.dataset.sysReady=FT.SYS;
</script>
<script id="ft-loader">{LOADER_JS}
if('serviceWorker' in navigator){{addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW',e)));}}
</script>
</body>
</html>
'''
html=HEAD+BODY
for bad in ['id="date"','id="chart"','id="stats"']: assert bad not in html, bad

# ---------- write site ----------
for f in ['index.html','sw.js','manifest.webmanifest']:
    p=f'{SITE}/{f}'
    if os.path.exists(p): os.remove(p)
os.makedirs(f'{SITE}/icons',exist_ok=True)
ICONS=['icon-16.png','icon-32.png','icon-48.png','icon-64.png','icon-128.png','icon-180.png','icon-192.png','icon-512.png','maskable-192.png','maskable-512.png']
for f in ICONS: shutil.copy(f'{SRC}/icon/{f}',f'{SITE}/icons/{f}')
shutil.copy(f'{SRC}/icon/favicon.ico',f'{SITE}/favicon.ico')
open(f'{SITE}/index.html','w').write(html)
open(f'{SITE}/manifest.webmanifest','w').write(json.dumps({"id":"./","name":"Mac's Jacks","short_name":"Mac's Jacks",
  "description":"Mangrove jack bite times + Baffle Creek tides (Bundaberg region)","start_url":"./","scope":"./","display":"standalone",
  "orientation":"portrait","background_color":"#0d1f22","theme_color":"#0b3b3a",
  "icons":[{"src":"icons/icon-192.png?v="+VER,"sizes":"192x192","type":"image/png","purpose":"any"},{"src":"icons/icon-512.png?v="+VER,"sizes":"512x512","type":"image/png","purpose":"any"},{"src":"icons/maskable-192.png?v="+VER,"sizes":"192x192","type":"image/png","purpose":"maskable"},{"src":"icons/maskable-512.png?v="+VER,"sizes":"512x512","type":"image/png","purpose":"maskable"}],
  "shortcuts":[{"name":"Bite times","url":"./#bite"},{"name":"Tides","url":"./#baffle"},{"name":"Map","url":"./#map"},{"name":"Gauges","url":"./#gauges"},{"name":"Calendar","url":"./#cal"},{"name":"Catch log","url":"./#log"}]},indent=1))
ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/icon-64.png','./icons/icon-128.png','./icons/icon-32.png','./favicon.ico',
        './mangrove-jack/','./mangrove-jack/index.html','./baffle-tides/','./baffle-tides/index.html','./data/gauges.json','./data/baffle_adj.json','./data/catches.csv','./data/systems/index.json','./vendor/leaflet/leaflet.js','./vendor/leaflet/leaflet.css']
SW=f'''/* Mac's Jacks service worker {VER} */
const CACHE='fishtimes-{VER}';
const OURS=/^(fishtimes|landing|mangrove-jack|baffle-tides)-/;
const TILES='fishtimes-tiles-v1',TILE_HOSTS=/^(tile[.]openstreetmap[.]org|server[.]arcgisonline[.]com)$/,TILE_MAX=800;  /* only touch this site's caches (origin is shared with other Pages repos) */
const ASSETS={json.dumps(ASSETS)};
self.addEventListener('install',e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{{cache:'reload'}})))).then(()=>self.skipWaiting()));}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>OURS.test(k)&&k!==CACHE&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));}});
self.addEventListener('fetch',e=>{{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(TILE_HOSTS.test(u.hostname)){{ /* map tiles: always network first (provider policies, normal HTTP caching); keep a bounded copy for offline use; never prefetch */
    e.respondWith(fetch(r).then(res=>{{if(res.ok&&res.type==='cors'){{const c=res.clone();caches.open(TILES).then(ca=>ca.put(r.url,c).then(()=>ca.keys()).then(ks=>{{if(ks.length>TILE_MAX)return Promise.all(ks.slice(0,ks.length-TILE_MAX).map(k=>ca.delete(k)));}}));}}return res;}})
      .catch(()=>caches.open(TILES).then(ca=>ca.match(r.url)).then(m=>m||new Response('',{{status:504}}))));return;}}
  if(u.origin!==location.origin)return; /* APIs: network only, the app keeps its own localStorage fallbacks */
  if(u.pathname.includes('/data/')){{e.respondWith(fetch(r).then(res=>{{if(res.ok){{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(u.origin+u.pathname,c));}}return res;}})
     .catch(()=>caches.match(u.origin+u.pathname).then(m=>{{if(!m)return new Response('{{}}',{{status:503}});const h=new Headers(m.headers);h.set('x-ft-cache','1');return m.blob().then(b=>new Response(b,{{status:200,headers:h}}));}})));return;}}
  if(r.mode==='navigate'){{e.respondWith(fetch(r).then(res=>{{if(res.ok){{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(r,c));}}return res;}})
     .catch(()=>caches.match(r,{{ignoreSearch:true}}).then(m=>m||caches.match('./index.html'))));return;}}
  e.respondWith(caches.match(r,{{ignoreSearch:true}}).then(m=>m||fetch(r).then(res=>{{if(res.ok){{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(r,c));}}return res;}})));}});
'''
open(f'{SITE}/sw.js','w').write(SW)
# legacy URLs -> redirect pages + self-destructing per-folder SWs (old home-screen icons keep working)
for slug,tab,title in [('mangrove-jack','bite','Mangrove Jack Bite Times'),('baffle-tides','baffle','Baffle Creek Tides')]:
    d=f'{SITE}/{slug}';os.makedirs(d,exist_ok=True)
    open(f'{d}/index.html','w').write(f'''<!DOCTYPE html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b3b3a"><title>{title} → Mac's Jacks</title><link rel="apple-touch-icon" href="../icons/icon-180.png">
<meta http-equiv="refresh" content="0;url=../#{tab}"><script>location.replace('../#{tab}');</script>
<style>body{{background:#0d1f22;color:#e8f1ef;font:15px system-ui;padding:24px}}a{{color:#7fd6ff}}</style></head>
<body>{title} has moved into <a href="../#{tab}">Mac's Jacks</a>…</body></html>''')
    open(f'{d}/sw.js','w').write(f'''/* retired: {slug} merged into Mac's Jacks ({VER}). Clean up and hand control to the root SW. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('{slug}-')).map(k=>caches.delete(k)));
  await self.registration.unregister();const cs=await self.clients.matchAll({{type:'window'}});cs.forEach(c=>c.navigate('../#{tab}').catch(()=>{{}}));}})()));
self.addEventListener('fetch',()=>{{}});
''')
    for f in ['manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png']:
        p=f'{d}/{f}'
        if os.path.exists(p): os.remove(p)
for f in ['icons/icon-180.png']: pass
open(f'{SITE}/.nojekyll','w').write('')
# river systems (lazy-loaded by the app; cached offline per system)
os.makedirs(f'{SITE}/data/systems',exist_ok=True)
for f in os.listdir(f'{SITE}/data/systems'):
    if f.endswith('.json'): os.remove(f'{SITE}/data/systems/{f}')
for f in os.listdir(SYSOUT):
    if f.endswith('.json'): shutil.copy(f'{SYSOUT}/{f}',f'{SITE}/data/systems/{f}')
shutil.copy(f'{SRC}/scripts/update_sys_gauges.py',f'{SITE}/scripts/update_sys_gauges.py')
shutil.copy(f'{SRC}/scripts/baffle_adj.py',f'{SITE}/scripts/baffle_adj.py')
assert os.path.exists(f'{SITE}/data/baffle_adj.json') or os.path.exists(f'{REPO}/data/baffle_adj.json'), 'data/baffle_adj.json must exist (precached by the SW): run scripts/baffle_adj.py'
# multi-system gauge archive: station list from the system builder (archives in data/sysg/arch are written by the routine)
os.makedirs(f'{SITE}/data/sysg',exist_ok=True);shutil.copy(f'{MSOUT}/sysg_stations.json',f'{SITE}/data/sysg/stations.json')
os.makedirs(f'{SITE}/vendor/leaflet',exist_ok=True)
for f in ['leaflet.js','leaflet.css','LICENSE']: shutil.copy(f'{SRC}/vendor/leaflet/{f}',f'{SITE}/vendor/leaflet/{f}')
# shared catch-log schema for the box ingestion script (scripts/ingest_catches.py)
os.makedirs(f'{SITE}/scripts',exist_ok=True);json.dump(C_SCHEMA,open(f'{SITE}/scripts/catch_schema.json','w'),ensure_ascii=False,indent=1)
assert os.path.exists(f'{SITE}/data/catches.csv'), 'data/catches.csv must exist (precached by the SW)'
open(f'{SITE}/404.html','w').write('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/fishing-apps/"><title>Not found</title><a href="/fishing-apps/">Mac&#39;s Jacks</a>')
print('built',VER,len(html))
