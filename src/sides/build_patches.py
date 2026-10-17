# exec'd by build.py just before "namespace IDs": Baffle side creeks in the Bite + Tides UIs (patches on the final JS texts)
def _p(name,old,new):
    g=globals();g[name]=patch(g[name],old,new)
_p('mj_ui',r"""l.baffleKm=(s&&s.offKm<=0.6&&s.km<=BT.MAXKM)?+Math.min(BT.MAXKM,s.km).toFixed(2):null;""",
 r"""const MX=s&&s.lineId&&BT.lineMaxKm?BT.lineMaxKm(s.lineId):BT.MAXKM;l.baffleKm=(s&&s.offKm<=0.6&&s.km<=MX+1e-6)?+Math.min(MX,s.km).toFixed(2):null;""")
_p('mj_ui',r"""function bafName(km,line){const L=BT.LANDMARKS.filter(l=>Math.abs(l.km-km)<0.3&&(!GENB||(l.line||'M')===(line||'M')))""",
 r"""function bafName(km,line){const L=BT.LANDMARKS.filter(l=>Math.abs(l.km-km)<0.3&&(GENB?(l.line||'M')===(line||'M'):(l.line||'B')===(line||'B')))""")
_p('mj_ui',r"""const c=r.cal,nm=bafName(BZ);
    srcHtml=`🌊 <b>Tide source: Baffle Creek along-creek model</b> @ ${BZ.toFixed(1)} km${nm?' ('+esc(nm)+')':''} — """,
 r"""const c=r.cal,nm=bafName(BZ,loc.baffleLine),AL=FT.spots&&FT.spots.alongLabel(BZ,loc.baffleLine);
    srcHtml=`🌊 <b>Tide source: Baffle Creek along-creek model</b> @ ${BZ.toFixed(1)} km${AL?' = '+esc(AL)+' up':loc.baffleLine==='E'?' (Euleilah Ck)':''}${nm?' ('+esc(nm)+')':''}${c.side||c.est&&loc.baffleLine==='E'&&BZ>BT.EUCAL?' — <b>est.</b>: junction timing + generic upstream lag/attenuation, no gauge here — <b>benchmark me</b>':''} — """)
# Tides tab: channel picker (Baffle Ck, Euleilah Ck, side creeks)
_p('bt_ui',r"""function syncLine(){if(!GEN)return;""",
 r"""function syncLine(){if(!GEN){if(!B.SIDES||!window.FT.spots)return;const CH=window.FT.spots.channels();const L=CH.find(c=>c.id===(st.bline||'B'))||CH[0];
  let s=document.getElementById('bt-line');if(!s){s=document.createElement('select');s.id='bt-line';s.setAttribute('aria-label','Channel');$('lm').after(s);
    s.innerHTML=CH.map(c=>`<option value="${c.id}">${esc(c.name)}${c.main?' (main)':' — joins km '+c.j.toFixed(1)+(c.est?' (est.)':'')}</option>`).join('');
    s.onchange=e=>{const C=CH.find(c=>c.id===e.target.value);if(!C)return;st.bline=C.main?null:C.id;syncLine();st.km=C.main?Math.min(st.km,C.max):Math.max(C.min,Math.min(C.max,st.km<=C.min||st.km>C.max?C.min+Math.min(1,(C.max-C.min)/2):st.km));st.landmark=null;st.gps=null;$('km').value=st.km;$('lm').value='';render();};}
  s.value=L.id;$('km').min=+L.min.toFixed(2);$('km').max=+L.max.toFixed(2);$('km').step=0.05;const kl=$('kmLbl');if(kl&&kl.nextElementSibling)kl.nextElementSibling.textContent=L.max.toFixed(1)+' km';return;}""")
_p('bt_ui',r"""else st.bline=line||null;st.km=Math.max(GEN&&st.line!=='M'?B.LINES.find(l=>l.id===st.line).j:0,Math.min(GEN?B.lineMax(st.line):B.MAXKM,km));""",
 r"""else{st.bline=line&&line!=='B'?line:null;syncLine();}st.km=Math.max(GEN&&st.line!=='M'?B.LINES.find(l=>l.id===st.line).j:(!GEN&&st.bline&&B.lineMinKm?Math.min(B.lineMinKm(st.bline),km):0),Math.min(GEN?B.lineMax(st.line):(B.lineMaxKm?B.lineMaxKm(st.bline||'B'):B.MAXKM),km));""")
_p('bt_ui',r"""const i=B.LANDMARKS.findIndex(l=>l.name===name&&(!GEN||(l.line||'M')===st.line));""",
 r"""const i=B.LANDMARKS.findIndex(l=>l.name===name&&(GEN?(l.line||'M')===st.line:(l.line||'B')===(st.bline||'B')));""")
_p('bt_ui',r"""else st.bline=s.lineId;st.km=Math.min(GEN?B.lineMax(s.lineId):B.MAXKM,s.km);""",
 r"""else{st.bline=s.lineId&&s.lineId!=='B'?s.lineId:null;syncLine();}st.km=Math.min(GEN?B.lineMax(s.lineId):(B.lineMaxKm?B.lineMaxKm(s.lineId||'B'):B.MAXKM),s.km);""")
_p('bt_ui',r"""syncLine();if(GEN)$('km').value=st.km;
const i0=B.LANDMARKS.findIndex(l=>Math.abs(l.km-st.km)<0.01&&(!GEN||(l.line||'M')===st.line));""",
 r"""if(!GEN){const v=localStorage.getItem(FK('bt_bline'));if(v&&B.lineMaxKm&&(v==='E'||(B.isSide&&B.isSide(v)))&&st.km>=B.lineMinKm(v)-1e-6&&st.km<=B.lineMaxKm(v)+1e-6)st.bline=v;}
syncLine();$('km').value=st.km;
const i0=B.LANDMARKS.findIndex(l=>Math.abs(l.km-st.km)<0.01&&(GEN?(l.line||'M')===st.line:(l.line||'B')===(st.bline||'B')));""")
_p('bt_ui',r"""if(GEN)localStorage.setItem(FK('bt_line'),st.line);""",r"""if(GEN)localStorage.setItem(FK('bt_line'),st.line);else localStorage.setItem(FK('bt_bline'),st.bline||'');""")
_p('bt_ui',r"""const pt=GEN?B.pointOnLine(km,st.line):B.pointAtKm(Math.min(km,B.MAXKM));""",
 r"""const pt=GEN?B.pointOnLine(km,st.line):(window.FT.spots?window.FT.spots.pointAt(km,st.bline||'B'):B.pointAtKm(Math.min(km,B.MAXKM)));""")
_p('bt_ui',r""":km.toFixed(2)+' km up Baffle Creek from the mouth'}""",
 r""":(window.FT.spots&&window.FT.spots.alongLabel(km,st.bline)?esc(window.FT.spots.alongLabel(km,st.bline))+' up (joins Baffle'+(B.parentOf(st.bline)==='E'?' via Euleilah Ck':'')+'; '+km.toFixed(2)+' km from the mouth) · <b>est.</b> tides':st.bline==='E'?km.toFixed(2)+' km from the mouth, on Euleilah Ck ('+(km-16.38).toFixed(1)+' km above its junction)'+(B.EUCAL&&km>B.EUCAL+1e-6?' · <b>est.</b> above the mapped river channel':''):km.toFixed(2)+' km up Baffle Creek from the mouth')}""")
_p('bt_ui',r"""  else if(cal.beyond)warn+='<div class="notice">Above Essendean Bridge""",
 r"""  else if(!GEN&&cal.side)warn+='<div class="notice">⚠ <b>Estimate — benchmark me.</b> No gauge on '+(cal.side.line==='E'?'upper Euleilah Ck':'this side creek')+': tide = the model at '+cal.side.base.toFixed(1)+' km (no single-high suppression) + a generic upstream lag (+'+Math.round(cal.side.d*5.2)+' min highs, +'+Math.round(cal.side.d*7.4)+' min lows for '+cal.side.d.toFixed(1)+' km) and attenuation. Allow ±'+Math.round(cal.hwU)+' min on highs, ±'+Math.round(cal.lwU)+' min on lows. Log a high/low turn here to calibrate it.</div>';
  else if(cal.beyond)warn+='<div class="notice">Above Essendean Bridge""")
_p('bt_ui',r"""<tr class="click${Math.abs(l.km-km)<0.01&&(!GEN||(l.line||'M')===st.line)?' sel':''}""",
 r"""<tr class="click${Math.abs(l.km-km)<0.01&&(GEN?(l.line||'M')===st.line:(l.line||'B')===(st.bline||'B'))?' sel':''}""")
_p('bt_ui',r"""baffleKm:+st.km.toFixed(2)},GEN?{baffleLine:st.line,sys:FT.SYS}:{}));""",r"""baffleKm:+st.km.toFixed(2)},GEN?{baffleLine:st.line,sys:FT.SYS}:st.bline?{baffleLine:st.bline}:{}));""")
