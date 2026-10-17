/* ===== River-system choice (runs before any tab script) =====
   FT.SYS = chosen system id ('baffle' = the original hand-calibrated Baffle Creek model, default).
   Choice: ?sys=<id> (one-off link) > localStorage ft_sys > 'baffle'. Switching reloads the page so every tab
   starts clean on the new system. Per-system settings use FT.k(key): Baffle keeps its original keys. */
(function(){const FT=window.FT;
FT.SYSIDX=/*SYSIDX*/[];
const by={};FT.SYSIDX.forEach(s=>by[s.id]=s);FT.sysById=id=>by[id]||null;
let id=null;try{const q=new URLSearchParams(location.search).get('sys');if(q&&by[q]){id=q;localStorage.setItem('ft_sys',q);}}catch(e){}
if(!id){try{id=localStorage.getItem('ft_sys');}catch(e){}}
const MERGED={'hussey-creek':'pumicestone-passage','halls-creek':'pumicestone-passage'};if(id&&MERGED[id]){id=MERGED[id];try{localStorage.setItem('ft_sys',id);}catch(e){}}
if(!id||!by[id])id='baffle';
FT.SYS=id;FT.SYSINFO=by[id];FT.SYSNAME=by[id].name;
FT.SYSSHORT=by[id].name.replace(/ Creek$/,' Ck').replace(/ River$/,' R').replace(/ Passage$/,' Psg');
FT.k=k=>id==='baffle'?k:k+'@'+id;
FT.switchSystem=function(nid,keepHash){if(!by[nid])return;try{localStorage.setItem('ft_sys',nid);}catch(e){}
  const u=new URL(location.href);u.searchParams.delete('sys');try{history.replaceState(null,'',u.pathname+u.search+(keepHash===false?'':location.hash));}catch(e){}location.reload();};
const SC='mbj-systems-v1';
FT.fetchSys=async function(name){const url=new URL('data/systems/'+name+'.json',location.href).href;
  try{const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw new Error('HTTP '+r.status);const c=r.clone();
    if(window.caches)caches.open(SC).then(ca=>ca.put(url,c)).catch(()=>{});return await r.json();}
  catch(e){if(window.caches){const ca=await caches.open(SC);const m=await ca.match(url);if(m)return m.json();}throw e;}};
FT.sysOffline=async function(){if(!window.caches)return{n:0,of:FT.SYSIDX.length};const ca=await caches.open(SC);const ks=await ca.keys();
  const have=new Set(ks.map(k=>k.url.replace(/.*\/data\/systems\//,'').replace(/\.json$/,'')));return{n:FT.SYSIDX.filter(s=>s.id!=='baffle'&&have.has(s.id)).length,of:FT.SYSIDX.length-1,have};};
FT.downloadAllSystems=async function(prog){const L=FT.SYSIDX.filter(s=>s.id!=='baffle');let i=0,bad=0;
  for(const s of L){try{await FT.fetchSys(s.id);}catch(e){bad++;}i++;prog&&prog(i,L.length);}
  try{await FT.fetchSys('index');}catch(e){bad++;}return{ok:L.length-bad,bad};};
})();
