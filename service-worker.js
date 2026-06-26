/* service-worker.js — offline-first PWA cache.
   Bump CACHE when any precached file changes. Uses relative URLs so the app
   works from GitHub Pages project subpaths and custom domains alike. */
const CACHE = 'coreseven-v10';

const ASSETS = [
  './',
  './index.html',
  './studio.html',
  './manifest.webmanifest',
  './vendor/phaser.min.js',
  './src/main.js',
  './src/ui/styles.css',
  './src/ui/UI.js',
  './src/engine/DataLoader.js',
  './src/engine/EventModel.js',
  './src/engine/BattleEngine.js',
  './src/engine/Storage.js',
  './src/engine/Theme.js',
  './src/engine/Pathfinder.js',
  './src/scenes/BootScene.js',
  './src/scenes/OverworldScene.js',
  './src/scenes/InteriorScene.js',
  './src/data/config.json',
  './src/data/events.json',
  './src/data/map.json',
  './src/data/wildNPCs.json',
  './src/assets/manifest.json',
  './src/assets/tiles/ground.png',
  './src/assets/tiles/road.png',
  './src/assets/tiles/concrete.png',
  './src/assets/tiles/wall.png',
  './src/assets/tiles/class_floor.png',
  './src/assets/tiles/class_wall.png',
  './src/assets/tiles/bay_floor.png',
  './src/assets/tiles/bay_wall.png',
  './src/assets/tiles/baydoor.png',
  './src/assets/sprites/player.png',
  './src/assets/sprites/rto.png',
  './src/assets/sprites/npc.png',
  './src/assets/sprites/wild.png',
  './src/assets/sprites/firetruck.png',
  './src/assets/sprites/sign.png',
  './src/assets/sprites/axe.png',
  './src/assets/sprites/saw.png',
  './src/assets/sprites/wrench.png',
  './src/assets/sprites/nozzle.png',
  './src/assets/sprites/bottle.png',
  './src/assets/sprites/hydrant.png',
  './src/assets/sprites/whiteboard.png',
  './src/assets/sprites/desk.png',
  './src/assets/fonts/KenneyFuture.ttf',
  './src/assets/fonts/KenneyFutureNarrow.ttf',
  './src/assets/fonts/KenneyBlocks.ttf',
  './src/assets/icons/icon-192.png',
  './src/assets/icons/icon-512.png',
  './src/assets/icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Cross-origin (e.g. web fonts): network, fall back to cache if present.
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Same-origin: cache-first, then network; cache new GETs; nav fallback to index.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return caches.match('./');
      });
    })
  );
});
