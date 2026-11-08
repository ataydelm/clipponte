// ClipPonte — service worker: funciona offline e recebe partilhas (Android).
const CACHE = 'clipponte-v2';
const SHELL = ['./', 'index.html', 'app.js', 'storage.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('clipponte', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [n, o] of [['items', { keyPath: 'id' }], ['blobs'], ['kv'], ['inbox', { autoIncrement: true }]]) {
        if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, o);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function handleShare(request) {
  const form = await request.formData();
  const files = form.getAll('files').filter(f => f && f.size);
  const entry = { title: form.get('title') || '', text: form.get('text') || '', url: form.get('url') || '', files };
  const d = await openDB();
  await new Promise((res, rej) => {
    const t = d.transaction('inbox', 'readwrite');
    t.objectStore('inbox').add(entry);
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
  return Response.redirect('./?shared=1', 303);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(e.request));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Rede primeiro (para receber atualizações), cache quando estiver offline.
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
