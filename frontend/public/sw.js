// Service Worker básico para suporte a PWA (instalável)
const CACHE_NAME = 'barberflow-cache-v1';

self.addEventListener('install', (event) => {
  // Ativa imediatamente o SW sem esperar o recarregamento
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Assume o controle dos clientes imediatamente
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Executa uma estratégia de pass-through direta (não interfere nas requisições do app)
  // Mas a presença desse listener de 'fetch' é obrigatória para o Chrome habilitar a instalação PWA
  event.respondWith(fetch(event.request));
});

// Listener para receber notificações push em segundo plano
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : { title: 'BarberFlow', body: 'Nova notificação' };
    const options = {
      body: data.body || 'Nova notificação no sistema',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'BarberFlow', options)
    );
  } catch (err) {
    console.error('Erro ao processar evento push:', err);
  }
});

// Listener para clique na notificação push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Tentar encontrar uma aba existente e focá-la
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      // Se não houver aba aberta, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
