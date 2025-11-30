/* service-worker.js (v6.0 - ArborIA Final) */

const CACHE_NAME = 'arboria-v6';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=3.0',
  
  // CSS Modules
  './css/modules/00_core.css',
  './css/modules/01_components.buttons.css',
  './css/modules/01_components.forms.css',
  './css/modules/01_components.tooltip.css',
  './css/modules/01_components.modal.css',
  './css/modules/01_components.helpers.css',
  './css/modules/01_components.auth.css',
  './css/modules/02_feature.manual_nav.css',
  './css/modules/02_feature.manual_content.css',
  './css/modules/02_feature.calculator.css',
  './css/modules/02_feature.checklist_mobile.css',
  './css/modules/02_feature.map.css',
  './css/modules/03_feature.clinometer.css',

  // JS Modules
  './js/main.js?v=2.0',
  './js/state.js',
  './js/ui.js',
  './js/map.ui.js',
  './js/modal.ui.js',
  './js/auth.ui.js',
  './js/features.js',
  './js/database.js',
  './js/utils.js',
  './js/content.js',
  './js/pdf.generator.js',
  './js/clinometer.js',
  './js/dap.estimator.js',
  './js/supabase-client.js',
  './js/arboria-module.js',

  // Ícones e Imagens
  './img/icons/favicon.png',
  './img/icons/icon-192x192.png',
  './img/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ArborIA] Cacheando assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ArborIA] Limpando cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
