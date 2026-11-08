// ClipPonte — armazenamento local (IndexedDB), pasta partilhada (File System Access)
// e OneDrive (Microsoft Graph). Tudo sem dependências externas.

/* ---------------- IndexedDB ---------------- */
// ?profile=x permite simular vários dispositivos no mesmo navegador (testes).
const PROFILE = new URLSearchParams(location.search).get('profile') || '';
const DB_NAME = 'clipponte' + (PROFILE ? '-' + PROFILE : '');
let dbPromise = null;
export function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('inbox')) d.createObjectStore('inbox', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}
function tx(store, mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export const idb = {
  get: (store, key) => tx(store, 'readonly', s => reqP(s.get(key))),
  all: (store) => tx(store, 'readonly', s => reqP(s.getAll())),
  put: (store, val, key) => tx(store, 'readwrite', s => { key === undefined ? s.put(val) : s.put(val, key); }),
  del: (store, key) => tx(store, 'readwrite', s => { s.delete(key); }),
  clear: (store) => tx(store, 'readwrite', s => { s.clear(); }),
  entries: (store) => tx(store, 'readonly', s => new Promise((res, rej) => {
    const out = []; const c = s.openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
    c.onerror = () => rej(c.error);
  })),
};
export const kv = {
  get: k => idb.get('kv', k),
  set: (k, v) => idb.put('kv', v, k),
  del: k => idb.del('kv', k),
};

/* ---------------- Pasta (Windows/macOS, Chrome/Edge) ---------------- */
export class FolderBackend {
  constructor(root) { this.root = root; this.kind = 'folder'; this.label = root.name; }
  static supported() { return 'showDirectoryPicker' in window; }
  async ensurePermission(ask) {
    if (!this.root.queryPermission) return true;
    const opts = { mode: 'readwrite' };
    if ((await this.root.queryPermission(opts)) === 'granted') return true;
    if (ask && (await this.root.requestPermission(opts)) === 'granted') return true;
    return false;
  }
  async _dir(parts, create) {
    let d = this.root;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create });
    return d;
  }
  async list(sub) {
    let d;
    try { d = await this._dir(sub.split('/'), true); } catch { return []; }
    const out = [];
    for await (const [name, h] of d.entries()) {
      if (h.kind !== 'file' || name.startsWith('.') || name.endsWith('.tmp')) continue;
      try { const f = await h.getFile(); out.push({ name, tag: f.lastModified + ':' + f.size }); } catch { /* ficheiro a sincronizar */ }
    }
    return out;
  }
  async _file(path, create) {
    const parts = path.split('/');
    const name = parts.pop();
    const d = await this._dir(parts, create);
    return d.getFileHandle(name, { create });
  }
  async readText(path) { return (await (await this._file(path, false)).getFile()).text(); }
  async readBlob(path) { return (await this._file(path, false)).getFile(); }
  async write(path, data) {
    const fh = await this._file(path, true);
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }
  async remove(path) {
    const parts = path.split('/');
    const name = parts.pop();
    try { const d = await this._dir(parts, false); await d.removeEntry(name); } catch { /* já não existe */ }
  }
}

/* ---------------- OneDrive (Microsoft Graph, PKCE) ---------------- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randStr = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
const SCOPES = 'Files.ReadWrite User.Read offline_access';
const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';

export class GraphAuth {
  constructor(clientId) { this.clientId = clientId; }
  get redirectUri() { return location.origin + location.pathname; }
  async login() {
    const verifier = randStr(48);
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const state = randStr(16);
    sessionStorage.setItem('cp_pkce', JSON.stringify({ verifier, state }));
    const p = new URLSearchParams({
      client_id: this.clientId, response_type: 'code', redirect_uri: this.redirectUri,
      scope: SCOPES, code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account',
    });
    location.href = `${AUTH}/authorize?${p}`;
  }
  // Chamado no arranque: troca o "code" devolvido pela Microsoft por tokens.
  static async handleRedirect(clientId) {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return false;
    history.replaceState(null, '', location.pathname);
    if (q.has('error')) throw new Error(q.get('error_description') || q.get('error'));
    const saved = JSON.parse(sessionStorage.getItem('cp_pkce') || '{}');
    if (saved.state !== q.get('state')) throw new Error('Resposta de login inválida (state).');
    const auth = new GraphAuth(clientId);
    await auth._token({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: auth.redirectUri, code_verifier: saved.verifier });
    sessionStorage.removeItem('cp_pkce');
    return true;
  }
  async _token(params) {
    const body = new URLSearchParams({ client_id: this.clientId, scope: SCOPES, ...params });
    const r = await fetch(`${AUTH}/token`, { method: 'POST', body });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.error || 'Falha no login');
    const tok = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
    await kv.set('graphToken', tok);
    return tok;
  }
  async accessToken() {
    const tok = await kv.get('graphToken');
    if (!tok) throw new Error('not-signed-in');
    if (tok.exp > Date.now()) return tok.access;
    const fresh = await this._token({ grant_type: 'refresh_token', refresh_token: tok.refresh });
    return fresh.access;
  }
  async signedIn() { return !!(await kv.get('graphToken')); }
  async logout() { await kv.del('graphToken'); }
}

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive/root:';
export class GraphBackend {
  constructor(auth, folder) {
    this.auth = auth; this.folder = folder || 'ClipPonte'; this.kind = 'onedrive'; this.label = 'OneDrive/' + this.folder;
  }
  _url(path, suffix = '') {
    const segs = [this.folder, ...path.split('/')].filter(Boolean).map(encodeURIComponent).join('/');
    return `${GRAPH}/${segs}:${suffix}`;
  }
  async _fetch(url, opts = {}) {
    const token = await this.auth.accessToken();
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` } });
    return r;
  }
  async whoAmI() {
    const r = await this._fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,userPrincipalName');
    return r.ok ? r.json() : null;
  }
  async list(sub) {
    const out = [];
    let url = this._url(sub, '/children?$select=name,eTag,file&$top=999');
    while (url) {
      const r = await this._fetch(url);
      if (r.status === 404) return out;
      if (!r.ok) throw new Error('OneDrive: ' + r.status);
      const j = await r.json();
      for (const it of j.value) if (it.file && !it.name.startsWith('.')) out.push({ name: it.name, tag: it.eTag });
      url = j['@odata.nextLink'] || null;
    }
    return out;
  }
  async readText(path) { return (await this.readBlob(path)).text(); }
  async readBlob(path) {
    const r = await this._fetch(this._url(path, '/content'));
    if (!r.ok) throw new Error('OneDrive: ' + r.status);
    return r.blob();
  }
  async write(path, data) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/json' });
    if (blob.size < 4 * 1024 * 1024) {
      const r = await this._fetch(this._url(path, '/content'), { method: 'PUT', body: blob });
      if (!r.ok) throw new Error('OneDrive: ' + r.status);
      return;
    }
    // Ficheiros grandes: sessão de upload em blocos.
    const s = await this._fetch(this._url(path, '/createUploadSession'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    });
    if (!s.ok) throw new Error('OneDrive: ' + s.status);
    const { uploadUrl } = await s.json();
    const CHUNK = 327680 * 10;
    for (let start = 0; start < blob.size; start += CHUNK) {
      const end = Math.min(start + CHUNK, blob.size);
      const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${end - 1}/${blob.size}` }, body: blob.slice(start, end) });
      if (!r.ok && r.status !== 202) throw new Error('OneDrive upload: ' + r.status);
    }
  }
  async remove(path) {
    const r = await this._fetch(this._url(path), { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Error('OneDrive: ' + r.status);
  }
}

/* ---------------- Store: histórico + sincronização ---------------- */
// Estrutura da pasta partilhada:
//   devices/<deviceId>.json   { id, name, platform, lastSeen }
//   items/<itemId>.json       metadados de cada item
//   blobs/<itemId>.<ext>      conteúdo de imagens e ficheiros
const LOCAL_FIELDS = ['synced', 'tag'];

export class Store {
  constructor(device) {
    this.device = device;          // { id, name, platform }
    this.items = new Map();
    this.devices = [];
    this.backend = null;
    this.retentionDays = 7;
    this.listeners = new Set();
    this.status = 'local';         // local | syncing | ok | error | paused
    this.lastError = '';
    this._syncing = false;
    this._lastHeartbeat = 0;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }
  async load() {
    for (const it of await idb.all('items')) this.items.set(it.id, it);
    this.devices = (await kv.get('devicesCache')) || [];
    this.emit();
  }
  sorted() { return [...this.items.values()].sort((a, b) => b.createdAt - a.createdAt); }
  findBySig(sig) { for (const it of this.items.values()) if (it.sig && it.sig === sig) return it; return null; }

  async add({ type, text = '', blob = null, name = '', mime = '', sig = '' }) {
    const id = Date.now().toString(36) + '-' + randStr(4).replace(/[-_]/g, 'x');
    const ext = blob ? extFor(name, mime || blob.type) : '';
    const meta = {
      id, type, text, name, mime: mime || (blob && blob.type) || '', size: blob ? blob.size : text.length,
      createdAt: Date.now(), device: this.device.id, deviceName: this.device.name,
      pinned: false, sig, blobPath: blob ? `blobs/${id}${ext}` : null, synced: false,
    };
    if (blob) await idb.put('blobs', blob, id);
    await idb.put('items', meta);
    this.items.set(id, meta);
    this.emit();
    this._push(meta).catch(e => this._fail(e));
    return meta;
  }
  async update(id, patch) {
    const it = this.items.get(id); if (!it) return;
    Object.assign(it, patch, { synced: false });
    await idb.put('items', it);
    this.emit();
    this._push(it).catch(e => this._fail(e));
  }
  async remove(id) {
    const it = this.items.get(id); if (!it) return;
    this.items.delete(id);
    await idb.del('items', id);
    await idb.del('blobs', id);
    this.emit();
    if (it.synced || this.backend) {
      const tomb = (await kv.get('tombstones')) || [];
      tomb.push({ id, blobPath: it.blobPath });
      await kv.set('tombstones', tomb);
      this._flushTombstones().catch(e => this._fail(e));
    }
  }
  async getBlob(id) {
    let b = await idb.get('blobs', id);
    if (b) return b;
    const it = this.items.get(id);
    if (!it || !it.blobPath || !this.backend) return null;
    b = await this.backend.readBlob(it.blobPath);
    if (it.mime && b.type !== it.mime) b = new Blob([b], { type: it.mime });
    await idb.put('blobs', b, id);
    return b;
  }

  /* ---- sincronização ---- */
  async setBackend(backend, reset = false) {
    this.backend = backend;
    this.status = backend ? 'syncing' : 'local';
    // Só ao MUDAR de pasta: itens deste dispositivo voltam a ser enviados,
    // os de outros dispositivos são esquecidos (serão lidos da nova pasta).
    if (reset) await kv.set('tombstones', []);
    for (const it of [...this.items.values()]) {
      if (!backend || !reset) continue;
      if (it.device === this.device.id) { it.synced = false; it.tag = null; await idb.put('items', it); }
      else { this.items.delete(it.id); await idb.del('items', it.id); await idb.del('blobs', it.id); }
    }
    this.emit();
    if (backend) await this.sync(true);
  }
  _fail(e) {
    console.warn(e);
    this.status = 'error';
    this.lastError = e && e.message ? e.message : String(e);
    this.emit();
  }
  async _push(meta) {
    if (!this.backend || this.paused) return;
    if (meta.blobPath) {
      const b = await idb.get('blobs', meta.id);
      if (b) await this.backend.write(meta.blobPath, b);
    }
    const clean = { ...meta };
    for (const f of LOCAL_FIELDS) delete clean[f];
    await this.backend.write(`items/${meta.id}.json`, JSON.stringify(clean));
    meta.synced = true;
    meta.tag = null; // força a reler a etiqueta no próximo ciclo
    await idb.put('items', meta);
  }
  async _flushTombstones() {
    if (!this.backend || this.paused) return;
    const tomb = (await kv.get('tombstones')) || [];
    const left = [];
    for (const t of tomb) {
      try {
        await this.backend.remove(`items/${t.id}.json`);
        if (t.blobPath) await this.backend.remove(t.blobPath);
      } catch (e) { left.push(t); }
    }
    await kv.set('tombstones', left);
  }
  async sync(force = false) {
    if (!this.backend || this._syncing || this.paused) return;
    this._syncing = true;
    try {
      await this._flushTombstones();
      // 1. enviar o que ainda não foi enviado
      for (const it of this.items.values()) if (!it.synced) await this._push(it);
      // 2. ler o que existe na pasta
      const remote = await this.backend.list('items');
      const remoteIds = new Set();
      let changed = false;
      for (const f of remote) {
        if (!f.name.endsWith('.json')) continue;
        const id = f.name.slice(0, -5);
        remoteIds.add(id);
        const local = this.items.get(id);
        if (local && local.tag === f.tag) continue;
        if (local && !local.synced) continue;
        try {
          const meta = JSON.parse(await this.backend.readText(`items/${f.name}`));
          if (!meta.id) continue;
          const merged = { ...meta, synced: true, tag: f.tag };
          await idb.put('items', merged);
          if (local && local.blobPath !== merged.blobPath) await idb.del('blobs', id);
          this.items.set(id, merged);
          changed = true;
        } catch (e) { /* ficheiro ainda a sincronizar no OneDrive */ }
      }
      // 3. apagados noutro dispositivo
      for (const it of [...this.items.values()]) {
        if (it.synced && !remoteIds.has(it.id)) {
          this.items.delete(it.id); await idb.del('items', it.id); await idb.del('blobs', it.id); changed = true;
        }
      }
      // 4. limpeza: itens com mais de N dias, exceto favoritos
      await this.purge();
      // 5. dispositivos
      await this._devices(force);
      this.status = 'ok'; this.lastError = '';
      if (changed || force) this.emit(); else this.emit();
    } catch (e) {
      this._fail(e);
    } finally {
      this._syncing = false;
    }
  }
  async purge() {
    const limit = Date.now() - this.retentionDays * 86400000;
    for (const it of [...this.items.values()]) {
      if (!it.pinned && it.createdAt < limit) await this.remove(it.id);
    }
  }
  async _devices(force) {
    if (force || Date.now() - this._lastHeartbeat > 5 * 60000) {
      this._lastHeartbeat = Date.now();
      await this.backend.write(`devices/${this.device.id}.json`, JSON.stringify({ ...this.device, lastSeen: Date.now() }));
    }
    const files = await this.backend.list('devices');
    const cache = new Map(this.devices.map(d => [d.id, d]));
    const out = [];
    for (const f of files) {
      if (!f.name.endsWith('.json')) continue;
      const id = f.name.slice(0, -5);
      const c = cache.get(id);
      if (c && c._tag === f.tag) { out.push(c); continue; }
      try { out.push({ ...JSON.parse(await this.backend.readText(`devices/${f.name}`)), _tag: f.tag }); } catch { if (c) out.push(c); }
    }
    this.devices = out;
    await kv.set('devicesCache', out);
  }
  async removeDevice(id, withItems) {
    if (this.backend) await this.backend.remove(`devices/${id}.json`);
    this.devices = this.devices.filter(d => d.id !== id);
    await kv.set('devicesCache', this.devices);
    if (withItems) for (const it of [...this.items.values()]) if (it.device === id) await this.remove(it.id);
    this.emit();
  }
  async announceDevice() {
    if (!this.backend) return;
    await this.backend.write(`devices/${this.device.id}.json`, JSON.stringify({ ...this.device, lastSeen: Date.now() }));
    this._lastHeartbeat = 0;
  }
}

export function extFor(name, mime) {
  const m = /\.[A-Za-z0-9]{1,8}$/.exec(name || '');
  if (m) return m[0].toLowerCase();
  const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'application/pdf': '.pdf', 'text/plain': '.txt' };
  return map[mime] || '.bin';
}
