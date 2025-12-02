/* service-worker.js (v7.0 - ArborIA PWA Refactored) */

const CACHE_NAME = 'arboria-v7-pwa';

// Lista exaustiva de recursos do App Shell
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './style.css',
  
  // Bibliotecas Locais
  './libs/leaflet.js',
  './libs/leaflet.css',
  './libs/proj4.js',
  './libs/jszip.min.js',

  // CSS Modules
  './css/modules/00_core.css',
  './css/modules/00_global.css',
  './css/modules/00_feature.welcome.css',
  './css/modules/01_components.buttons.css',
  './css/modules/01_components.forms.css',
  './css/modules/01_components.helpers.css',
  './css/modules/01_components.auth.css',
  './css/modules/01_components.icons.css',
  './css/modules/01_components.login.css',
  './css/modules/01_components.modal.css',
  './css/modules/01_components.tooltip.css',
  './css/modules/02_feature.calculator.css',
  './css/modules/02_feature.checklist_mobile.css',
  './css/modules/02_feature.manual_content.css',
  './css/modules/02_feature.manual_nav.css',
  './css/modules/02_feature.map.css',
  './css/modules/02_feature.planning.css',
  './css/modules/02_feature.sync.css',
  './css/modules/03_feature.clinometer.css',

  // JS Modules & Scripts
  './js/main.js',
  './js/arboria-module.js',
  './js/supabase-client.js',
  './js/auth.guard.js',
  './js/sync-features.js',
  './js/realtime.service.js',
  './js/sync.ui.js',
  './js/state.js',
  './js/ui.js',
  './js/map.ui.js',
  './js/modal.ui.js',
  './js/auth.ui.js',
  './js/features.js',
  './js/features_patch.js',
  './js/database.js',
  './js/utils.js',
  './js/content.js',
  './js/pdf.generator.js',
  './js/clinometer.js',
  './js/dap.estimator.js',
  './js/calculator.form.ui.js',
  './js/checklist.service.js',
  './js/table.ui.js',
  './js/tooltip.ui.js',
  './js/gps.service.js',
  './js/import-export.service.js',
  './js/tree.service.js',

  // Ícones e Imagens Principais
  './img/icons/favicon.png',
  './img/icons/icon-192x192.png',
  './img/icons/icon-512x512.png',
  './img/icons/new-logo_dobrado.png',
  './img/icons/calc.png',
  './img/icons/clinometro.png',
  './img/icons/dap.png',
  './img/icons/plano-intervencao.png',
  './img/icons/definicoes.png',
  './img/icons/planejamento.png',
  './img/icons/legal.png',
  './img/icons/preparacao.png',
  './img/icons/poda.png',
  './img/icons/epi.png',
  './img/icons/residuos.png',
  './img/icons/glossario.png',
  './img/icons/autor.png'
];

// Instalação: Cache do App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força a ativação imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando App Shell...');
      // addAll falha se UM arquivo falhar. Usamos map para logar falhas individuais se necessário,
      // mas addAll é o padrão para garantir integridade.
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error('[SW] Falha ao cachear assets:', err);
      });
    })
  );
});

// Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle imediatamente
  );
});

// Fetch: Estratégias de Cache
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET (POST, DELETE, etc.) e chrome-extension
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  const url = new URL(event.request.url);

  // ESTRATÉGIA 1: Navegação (HTML) -> Network First, Fallback Cache, Fallback Offline Page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Se não tem rede nem cache da página, serve a página offline
            return caches.match('./offline.html');
          });
        })
    );
    return;
  }

  // ESTRATÉGIA 2: Assets Estáticos (JS, CSS, Imagens, Fonts, Libs) -> Cache First, Update in Background (Stale-while-revalidate modificada)
  // Para maior performance e funcionamento offline, tentamos o cache primeiro.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Se não estiver no cache, busca na rede
      return fetch(event.request).then((networkResponse) => {
        // Verifica se a resposta é válida antes de cachear
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cacheia o novo recurso dinamicamente
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
          // Se falhar a rede para uma imagem, poderia retornar um placeholder
          // if (event.request.destination === 'image') return caches.match('./img/placeholder.png');
      });
    })
  );
});
