/* Offline support.
 *
 * Two strategies on purpose:
 *   - code and markup are fetched from the network first, so shipping a fix
 *     actually reaches players instead of being masked by a stale cache;
 *   - art, fonts and audio never change without changing name, so those are
 *     served from the cache first and the network is only a fallback.
 * Bump CACHE when you rename, add or remove an asset.
 */
var CACHE = 'bhb-dive-v1';

var CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/atlas.js', './js/world.js', './js/game.js',
  './favicon.png', './icons/icon-192.png', './icons/icon-512.png',
  './assets/fonts/OpenDyslexic-Regular.woff2',
  './assets/fonts/OpenDyslexic-Bold.woff2'
];

['bob', 'lisa', 'pair0', 'pair1', 'goby', 'shrimp', 'weed0', 'weed1',
 'bg1', 'bg2', 'bg3', 'mg1', 'mg2', 'mg3',
 'fg1', 'fg2', 'fg3', 'fg4', 'fg5', 'splash', 'sunset']
  .forEach(function (n) { CORE.push('./assets/img/' + n + '.webp'); });

['ambience', 'bubbles', 'collect', 'click', 'gameover', 'reward']
  .forEach(function (n) { CORE.push('./assets/audio/' + n + '.m4a'); });

/* The song is 1.5 MB and the dive plays perfectly without it, so it is only
   cached once a player has actually heard it. */

function isCode(url) {
  return /\.(?:html|css|js|json|webmanifest)$/.test(url.pathname) ||
    url.pathname.endsWith('/');
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function store(request, response) {
  if (response && response.ok && response.type === 'basic') {
    var copy = response.clone();
    caches.open(CACHE).then(function (c) { c.put(request, copy); });
  }
  return response;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') { return; }

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) { return; }

  if (req.mode === 'navigate' || isCode(url)) {
    e.respondWith(
      fetch(req)
        .then(function (res) { return store(req, res); })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { return store(req, res); });
    })
  );
});
