/* Service worker do CRM Atomic Segurança.
 *
 * Estratégia:
 * - Navegações (o HTML do app): network-first, cai para o cache do shell e,
 *   por fim, para a página amigável de offline.
 * - API/autenticação PocketBase (/api/): SEMPRE network-first e a resposta
 *   NUNCA é gravada no cache — login, sessão e dados ao vivo não são
 *   servidos "velhos" ou de fora do cookie da sessão.
 * - Assets estáticos (JS/CSS/imagens/fontes com hash do build): cache-first,
 *   pois o nome do arquivo muda a cada build.
 * - O cache antigo é limpo quando a versão do SW (CACHE_VERSION) muda.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `crm-shell-${CACHE_VERSION}`
const ASSET_CACHE = `crm-assets-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

// Arquivos mínimos para abrir o app sem internet (a navegação em si é
// buscada da rede primeiro; o shell serve de fallback).
const SHELL_ASSETS = [OFFLINE_URL, '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** É um dado vivo (API PocketBase, webhook etc.) — nunca cachear. */
const isApiRequest = (url) => url.pathname.startsWith('/api/') || url.pathname.includes('/pb/')

/** É um asset estático do build (Vite emite com hash no nome). */
const isStaticAsset = (url) =>
  url.pathname.startsWith('/assets/') ||
  /\.(?:css|js|mjs|woff2?|png|jpg|jpeg|gif|svg|webp|avif|ico)$/.test(url.pathname)

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    // Só cacheia respostas básicas OK (mesma origem, sem erro/opaque).
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const fallback = await cache.match(request)
    if (fallback) return fallback
    throw err
  }
}

const networkFirstNavigation = async (request) => {
  try {
    return await fetch(request)
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE)
    const index = await cache.match('/', { ignoreSearch: true })
    if (index) return index
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    throw err
  }
}

/** Network-first SEM gravar nada: usado para dados e autenticação. */
const networkOnlyPassThrough = async (request) => {
  try {
    return await fetch(request)
  } catch (err) {
    const cache = await caches.open(SHELL_CACHE)
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Outra origem (CDN, backend da VPS em subdomínio próprio etc.):
  // não interferimos no cache — deixa o navegador resolver.
  if (url.origin !== self.location.origin) return

  // Navegação (abrir o app / trocar de rota em modo standalone).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // Dados e sessão: rede sempre, nada vai para o cache.
  if (isApiRequest(url)) {
    event.respondWith(networkOnlyPassThrough(request))
    return
  }

  // Assets estáticos: cache-first (o nome do arquivo muda a cada build).
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // Demais GETs (index.html dev, arquivos públicos): rede primeiro.
  event.respondWith(networkFirstNavigation(request))
})
