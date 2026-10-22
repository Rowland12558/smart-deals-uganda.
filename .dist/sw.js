const CACHE = 'smart-deals-uganda-v27';
const FILES = [
  './',
  './index.html',
  './privacy.html',
  './styles.css',
  './app.js',
  './data/products.json',
  './data/ads.json',
  './data/integrations.json',
  './assets/slinda-17-pro-max-kids-tablet.png',
  './assets/catalog-sample-sneakers.jpg',
  './assets/catalog-sample-skincare.jpg',
  './assets/catalog-sample-phone.jpg',
  './assets/catalog-sample-laptop.jpg',
  './assets/catalog-sample-headphones.jpg',
  './assets/catalog-sample-blender.jpg',
  './assets/catalog-sample-bag.jpg',
  './assets/catalog-sample-airfryer.jpg',
  './assets/catalog-jumia-woven-tote.jpg',
  './assets/catalog-jumia-samsung-a07.jpg',
  './assets/catalog-jumia-samsung-a06.jpg',
  './assets/catalog-jumia-roch-kettle.jpg',
  './assets/catalog-jumia-redmi-15c.jpg',
  './assets/catalog-jumia-pixel-blender.jpg',
  './assets/catalog-jumia-pixel-airfryer.jpg',
  './assets/catalog-jumia-oraimo-watch-5-lite.jpg',
  './assets/catalog-jumia-nivea-cool-kick-set.jpg',
  './assets/catalog-jumia-hisense-tv-32.jpg',
  './assets/oraimo-nutrifry-s1-ultra.jpg',
  './assets/oraimo-flexicooker.jpg',
  './assets/oraimo-multipot-s1-lite.jpg',
  './assets/oraimo-nutrifry-duo.jpg',
  './assets/dan-soft-shoe-dryer.jpg',
  './assets/oraimo-easycut-2.jpg',
  './assets/oraimo-smart-clipper-2.jpg',
  './assets/oraimo-nimbletype-keyboard.jpg',
  './assets/oraimo-slice-power-bank.jpg',
  './assets/oraimo-boompop-lite.jpg',
  './assets/oraimo-opencirclet-2.jpg',
  './assets/oraimo-type-c-halo-headset.jpg',
  './assets/oraimo-opensnap-clip-on.jpg',
  './assets/oraimo-smartairfryer-5l.jpg',
  './manifest.webmanifest',
  './assets/smart-deals-logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return (await cache.match('./index.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
