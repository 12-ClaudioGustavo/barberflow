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
