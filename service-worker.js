/* service-worker.js (v5.0 - ArborIA Final) */

const CACHE_NAME = 'arboria-v5';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './style.css?v=72.0', // Atualizado para a versão do HTML
  
  // CSS Modules
  './css/modules/00_core.css',
  './css/modules/01_components.buttons.css',
  './css/modules/01_components.forms.css',
  './css/modules/01_components.tooltip.css',
  './css/modules/01_components.modal.css',
  './css/modules/01_components.helpers.css',
  './css/modules/02_feature.manual_nav.css',
  './css/modules/02_feature.manual_content.css',
  './css/modules/02_feature.calculator.css',
  './css/modules/02_feature.checklist_mobile.css',
  './css/modules/02_feature.map.css',
  './css/modules/03_feature.clinometer.css',

  // JS Modules
  './js/main.js?v=72.0',
  './js/state.js',
  './js/ui.js',
  './js/map.ui.js',
  './js/modal.ui.js',
  './js/features.js',
  './js/database.js',
  './js/utils.js',
  './js/content.js',
  './js/pdf.generator.js',
  './js/clinometer.js',
  './js/dap.estimator.js',

  // Ícones e Imagens
  './img/icons/favicon.png',
  './img/icons/icon-192x192.png',
  './img/icons/icon-512x512.png',

  // Libs
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
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
