// Nome da cache com versão (altere a versão quando atualizar o app)
const CACHE_NAME = 'sono-profundo-v1.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  // Ícones SVG inline já estão no HTML, mas podemos cachear se necessário
];

// ========== INSTALL ==========
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache aberto, adicionando assets essenciais...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('✅ Todos os assets foram cacheados com sucesso!');
        // Força o SW a assumir o controle imediatamente
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Falha ao cachear assets:', error);
      })
  );
});

// ========== ACTIVATE ==========
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remove caches antigas (versões anteriores)
            if (cacheName !== CACHE_NAME) {
              console.log(`🗑️ Removendo cache antiga: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('🎯 Service Worker ativado e caches limpos!');
        // Assume controle de todas as páginas imediatamente
        return self.clients.claim();
      })
  );
});

// ========== FETCH ==========
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Ignora requisições que não são GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Estratégia especial para áudio (Web Audio API) - sempre network first
  if (url.pathname.includes('audio') || request.destination === 'audio') {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => {
          console.warn('🎵 Áudio não disponível offline');
          return new Response('Áudio não disponível offline', { status: 408 });
        })
    );
    return;
  }
  
  // Estratégia: Cache First, com fallback para Network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Retorna do cache se encontrado
        if (cachedResponse) {
          // Atualiza o cache em background (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, networkResponse.clone());
                  });
              }
            })
            .catch(() => {
              // Ignora erros de atualização em background
            });
          
          return cachedResponse;
        }
        
        // Se não está no cache, busca na rede
        return fetch(request)
          .then((networkResponse) => {
            // Verifica se a resposta é válida
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Clona a resposta para cachear
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cacheia apenas URLs do mesmo domínio ou CDNs confiáveis
                if (url.origin === location.origin || 
                    url.hostname === 'cdn.tailwindcss.com') {
                  cache.put(request, responseToCache);
                }
              });
            
            return networkResponse;
          })
          .catch((error) => {
            console.error('❌ Erro ao buscar recurso:', request.url, error);
            
            // Fallback offline para navegação
            if (request.mode === 'navigate') {
              return caches.match('./index.html')
                .then(response => {
                  if (response) {
                    return response;
                  }
                  // Fallback final - página offline simples
                  return new Response(
                    '<html><body style="background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><div style="text-align:center"><h1>🌙 Sono Profundo</h1><p>Você está offline</p><p style="font-size:14px;opacity:0.7">Conecte-se à internet para carregar o app</p></div></body></html>',
                    { 
                      status: 200, 
                      statusText: 'OK',
                      headers: { 'Content-Type': 'text/html' }
                    }
                  );
                });
            }
            
            // Para outros recursos, retorna erro
            return new Response('Recurso não disponível offline', { status: 408 });
          });
      })
  );
});

// ========== MENSAGENS DO CLIENTE ==========
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Permite que o cliente solicite atualização de cache
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(event.data.urls))
        .then(() => {
          console.log('📦 URLs adicionais cacheados com sucesso!');
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
    );
  }
});

// ========== NOTIFICAÇÕES PUSH (Opcional) ==========
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Hora de relaxar e dormir bem!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'sono-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'Abrir App' },
      { action: 'close', title: 'Fechar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('🌙 Sono Profundo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('./');
          }
        })
    );
  }
});

console.log('🎯 Service Worker do Sono Profundo carregado e pronto!');
