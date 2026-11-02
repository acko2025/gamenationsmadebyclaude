// War Of Nations offline cache. Bump VERSION (the build script does) to ship an update.
const VERSION = 'won-20261101235331';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'ai.js', 'commands.js', 'data.js', 'flags.js', 'histmaps.js', 'net.js', 'orgs.js', 'province3d.js', 'realmaps.js', 'sim.js', 'ui.js', 'ui2.js', 'world.js', 'worlddata.js'];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(async c => {
    await c.addAll(CORE);
    for (const u of CDN) { try { await c.add(new Request(u, { mode: 'cors' })); } catch (err) { /* cached on first online use */ } }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /(^|\.)(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!cacheable) return;
  // cache first (works offline); refresh the copy in the background when online
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (url.pathname.endsWith('/') ? c.match('index.html') : Response.error());
  }));
});