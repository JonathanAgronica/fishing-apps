// Offline support: same-origin files are network-first with cache fallback
// (so updates arrive when online); cross-origin API calls go straight to the network.
const CACHE='baffle-tides-v202610091409';
const ASSETS=["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('baffle-tides-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return; // APIs: network only
  e.respondWith(fetch(req).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return res;})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):undefined)).then(r=>r||new Response('Offline',{status:503}))));
});
