/* retired: baffle-tides merged into Mac's Baffle Jacks (202610091718). Clean up and hand control to the root SW. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('baffle-tides-')).map(k=>caches.delete(k)));
  await self.registration.unregister();const cs=await self.clients.matchAll({type:'window'});cs.forEach(c=>c.navigate('../#baffle').catch(()=>{}));})()));
self.addEventListener('fetch',()=>{});
