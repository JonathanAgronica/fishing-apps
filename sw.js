/* Mac's Jacks service worker 202610101007 */
const CACHE='fishtimes-202610101007';
const OURS=/^(fishtimes|landing|mangrove-jack|baffle-tides)-/;
const TILES='fishtimes-tiles-v1',TILE_HOSTS=/^(tile[.]openstreetmap[.]org|server[.]arcgisonline[.]com)$/,TILE_MAX=800;  /* only touch this site's caches (origin is shared with other Pages repos) */
const ASSETS=["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./mangrove-jack/", "./mangrove-jack/index.html", "./baffle-tides/", "./baffle-tides/index.html", "./data/gauges.json", "./data/catches.csv", "./data/systems/index.json", "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>OURS.test(k)&&k!==CACHE&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(TILE_HOSTS.test(u.hostname)){ /* map tiles: always network first (provider policies, normal HTTP caching); keep a bounded copy for offline use; never prefetch */
    e.respondWith(fetch(r).then(res=>{if(res.ok&&res.type==='cors'){const c=res.clone();caches.open(TILES).then(ca=>ca.put(r.url,c).then(()=>ca.keys()).then(ks=>{if(ks.length>TILE_MAX)return Promise.all(ks.slice(0,ks.length-TILE_MAX).map(k=>ca.delete(k)));}));}return res;})
      .catch(()=>caches.open(TILES).then(ca=>ca.match(r.url)).then(m=>m||new Response('',{status:504}))));return;}
  if(u.origin!==location.origin)return; /* APIs: network only, the app keeps its own localStorage fallbacks */
  if(u.pathname.includes('/data/')){e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(u.origin+u.pathname,c));}return res;})
     .catch(()=>caches.match(u.origin+u.pathname).then(m=>{if(!m)return new Response('{}',{status:503});const h=new Headers(m.headers);h.set('x-ft-cache','1');return m.blob().then(b=>new Response(b,{status:200,headers:h}));})));return;}
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(r,c));}return res;})
     .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));return;}
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>m||fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(r,c));}return res;})));});
