// Bump this version whenever any shipped module, page or icon changes.
const VERSION = '20261125T234437Z';
const PREFIX = 'little-playroom:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const ids = `bubbles paint fireworks balls kaleido stars rain peekaboo pads balloons
  magnets pond daynight blob blocks xylophone snow worm lights shapes
  flowers butterflies frogs fireflies berries train boats planes tractors rockets
  turtles carousel rainbows digger clouds hotair ducks submarine garden pinwheels`.split(/\s+/);
const files = [
  './index.html', './sw.js', './manifest.webmanifest', './shell.js', './audio.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './games/registry.js', './games/placeholder.js', ...ids.map(id => './games/' + id + '.js'),
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(files.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const stale = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    await Promise.all(stale.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : request;
    return await cache.match(key) || fetch(request);
  })());
});
