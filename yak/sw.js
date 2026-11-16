/* Mac's Yak service worker 202611170628 — only touches caches prefixed "macsyak-" (the github.io origin is shared with Mac's Jacks, Marlin and Crabs).
   Offline: app shell cache-first; Mac's Jacks flood_state network-first; forecasts are kept by the page in localStorage.
   Alerts: periodic background sync (Android Chrome, installed) re-checks the next kayak day and shows a notification once per slot. */
const CACHE='macsyak-202611170628',DATA='macsyak-data',TILES='macsyak-tiles',SETC='macsyak-settings',TILE_MAX=600;
const ASSETS=['./','./index.html','./manifest.webmanifest','./astro.js?v=202611170628','./data.js?v=202611170628','./core.js?v=202611170628','./favicon.ico','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-64.png','./icons/icon-32.png','./icons/maskable-192.png','./icons/maskable-512.png','./vendor/leaflet/leaflet.js','./vendor/leaflet/leaflet.css'];
importScripts('astro.js?v=202611170628','data.js?v=202611170628','core.js?v=202611170628');
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>/^macsyak-\d/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const put=(name,req,res)=>caches.open(name).then(c=>c.put(req,res));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(u.hostname==='server.arcgisonline.com'){e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(TILES).then(ca=>ca.put(r,c).then(()=>ca.keys()).then(ks=>ks.length>TILE_MAX&&Promise.all(ks.slice(0,ks.length-TILE_MAX).map(k=>ca.delete(k)))));}return res;}).catch(()=>caches.open(TILES).then(ca=>ca.match(r)).then(m=>m||new Response('',{status:504}))));return;}
  if(u.origin!==location.origin||!(u.pathname.includes('/yak/')||u.pathname.includes('/fishing-apps/data/')))return; /* APIs (Open-Meteo): network only */
  if(u.pathname.includes('/fishing-apps/data/')){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok)put(DATA,u.pathname,res.clone());return res;}).catch(()=>caches.open(DATA).then(c=>c.match(u.pathname)).then(m=>m||new Response('{}',{status:503}))));return;}
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok)put(CACHE,'./index.html',res.clone());return res;}).catch(()=>caches.open(CACHE).then(c=>c.match('./index.html'))));return;}
  e.respondWith(caches.open(CACHE).then(c=>c.match(r,{ignoreSearch:!u.search.includes('v=')})).then(m=>m||fetch(r)));});
/* ---- background check ---- */
async function readJSON(key){const c=await caches.open(SETC);const m=await c.match(key);return m?m.json():null;}
async function writeJSON(key,v){const c=await caches.open(SETC);await c.put(key,new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));}
async function bgCheck(){const S=await readJSON('./__settings.json');if(!S||!S.notify||!S.spot||!S.days||!S.days.length)return;
  const now=Date.now(),h=tzParts(now,YAK.TZ).h,t=ymd(now,YAK.TZ),tm=addDays(t,1),dow=d=>new Date(d+'T12:00:00Z').getUTCDay();
  const want=[];if(h<11&&S.days.includes(dow(t)))want.push([t,'am']);if(h>=14&&S.days.includes(dow(tm)))want.push([tm,'eve']);if(!want.length)return;
  const sent=(await readJSON('./__sent.json'))||{};const todo=want.filter(([d,s])=>!sent[d+'|'+s]);if(!todo.length)return;
  const F=await YAK.fetchForecast(S.spot,3);const fmt=ms=>{const p=tzParts(ms,YAK.TZ);return (p.h%12||12)+':'+String(p.mi).padStart(2,'0')+(p.h<12?'am':'pm');};
  for(const [d,slot] of todo){const a=YAK.analyseDay(F,d,S.spot,Object.assign({},YAK.DEFAULTS,S.s),null);if(!a)continue;sent[d+'|'+slot]=now;
    const body=`${YAK.EMO[a.lvl]} ${YAK.LV[a.lvl]} at ${S.spot.name}. Wind ${Math.round(a.wind[0])}–${Math.round(a.wind[1])} kn, gusts ${Math.round(a.gust)}.`+(a.win?` Best ${fmt(a.win.t0)}–${fmt(a.win.t1+36e5)}.`:'')+(a.turn&&a.turn.by?` Head back by ${fmt(a.turn.by)}.`:'');
    await self.registration.showNotification((slot==='am'?'Today: ':'Tomorrow: ')+"Mac's Yak",{body,icon:'icons/icon-192.png',badge:'icons/icon-64.png',tag:'yak-'+d});}
  await writeJSON('./__sent.json',sent);}
self.addEventListener('periodicsync',e=>{if(e.tag==='yak-check')e.waitUntil(bgCheck().catch(()=>{}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.tag&&e.notification.tag.startsWith('ci')?'./#trip':'./';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs)if(c.url.includes('/yak/'))return c.focus();return self.clients.openWindow(url);}));});
