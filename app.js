// ClipPonte — interface e comportamento.
import { Store, FolderBackend, GraphAuth, GraphBackend, kv, idb } from './storage.js';

/* ---------- ícones ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  pin: P('<path d="M12 17v5"/><path d="M9 10.8V5h6v5.8l2.5 3.2H6.5z"/><path d="M8 3h8"/>'),
  hide: P('<path d="M4 14h16"/><path d="M8 18h8"/><path d="M12 4v6"/><path d="m9 7 3 3 3-3"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  paste: P('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11v6"/><path d="M9 14h6"/>'),
  plus: P('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  star: P('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'),
  starFill: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>`,
  trash: P('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
  text: P('<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>'),
  link: P('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'),
  file: P('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  image: P('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>'),
  install: P('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>'),
  close: P('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
};

/* ---------- utilidades ---------- */
const app = document.getElementById('app');
const $ = s => app.querySelector(s); // funciona também quando a app está na janela flutuante
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 45) return 'agora';
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  if (s < 172800) return 'ontem';
  return new Date(t).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}
async function sha(data) {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : await data.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const isLink = t => /^(https?:\/\/|www\.)\S+$/i.test(t.trim());
function guessPlatform() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'macOS';
  return 'Linux';
}

/* ---------- estado ---------- */
const DEFAULTS = { mode: 'local', clientId: '', odFolder: 'ClipPonte', autoCapture: !isMobile, retentionDays: 7, hiddenDevices: [], maxMB: 25, paused: false, hintSeen: false };
let settings;
let device;
let store;
let filter = 'all';
let query = '';
let selIndex = -1;
let visible = [];
let pip = null;
let pipSize = null;
let selfSig = '';          // assinatura do último item copiado pela própria app
let lastRawKey = '';       // evita recalcular hashes enquanto o clipboard não muda
let folderNeedsPermission = null;
let deferredInstall = null;
const thumbs = new Map();  // id -> objectURL
let settingsOpen = false;
let settingsErr = '';

const curWin = () => pip || window;
async function saveSettings() { await kv.set('settings', settings); }

/* ---------- arranque ---------- */
async function boot() {
  settings = { ...DEFAULTS, ...((await kv.get('settings')) || {}) };
  device = await kv.get('device');
  if (!device) {
    const platform = guessPlatform();
    device = { id: crypto.randomUUID(), name: platform === 'Windows' || platform === 'Linux' ? `PC ${platform}` : platform, platform };
    await kv.set('device', device);
  }
  store = new Store(device);
  store.retentionDays = settings.retentionDays;
  store.paused = settings.paused;
  store.on(render);
  await store.load();

  // ícones estáticos
  $('#btnTop').innerHTML = I.pin; $('#btnHide').innerHTML = I.hide; $('#btnSettings').innerHTML = I.gear;
  $('#icoSearch').innerHTML = I.search; $('#icoPaste').innerHTML = I.paste; $('#btnFile').innerHTML = I.plus;
  $('#btnInstall').innerHTML = I.install;
  wireUI();
  attachGlobal(document);

  // Regresso do login Microsoft
  if (settings.clientId) {
    try {
      if (await GraphAuth.handleRedirect(settings.clientId)) {
        settings.mode = 'onedrive'; await saveSettings();
        await connect(true);
        toast('OneDrive ligado');
      } else await connect(false);
    } catch (e) { settingsErr = e.message; await connect(false); openSettings(); }
  } else await connect(false);

  await importInbox();
  render();
  setInterval(() => store.sync(), settings.mode === 'onedrive' ? 8000 : 3000);
  setInterval(autoCapture, 1500);
  setInterval(() => store.purge(), 3600000);
  window.addEventListener('focus', () => { store.sync(); autoCapture(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { store.sync(); importInbox(); } });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#btnInstall').hidden = false; });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (new URLSearchParams(location.search).has('shared')) history.replaceState(null, '', location.pathname);
}

async function connect(reset) {
  folderNeedsPermission = null;
  if (settings.mode === 'folder') {
    const handle = await kv.get('folderHandle');
    if (!handle) { await store.setBackend(null); return; }
    const be = new FolderBackend(handle);
    if (await be.ensurePermission(false)) await store.setBackend(be, reset);
    else { folderNeedsPermission = be; await store.setBackend(null); }
  } else if (settings.mode === 'onedrive' && settings.clientId) {
    const auth = new GraphAuth(settings.clientId);
    if (await auth.signedIn()) await store.setBackend(new GraphBackend(auth, settings.odFolder), reset);
    else await store.setBackend(null);
  } else {
    await store.setBackend(null);
  }
  render();
}

async function chooseFolder() {
  try {
    const handle = await window.showDirectoryPicker({ id: 'clipponte', mode: 'readwrite' });
    await kv.set('folderHandle', handle);
    settings.mode = 'folder'; await saveSettings();
    await connect(true);
    toast(`Pasta "${handle.name}" ligada`);
    renderSettings();
  } catch (e) { if (e.name !== 'AbortError') { settingsErr = e.message; renderSettings(); } }
}

/* ---------- adicionar ---------- */
async function addText(text, { manual = false } = {}) {
  text = text.replace(/\r\n/g, '\n');
  if (!text.trim()) return null;
  const sig = 't:' + await sha(text);
  return addWithSig({ type: isLink(text) ? 'link' : 'text', text: text, sig }, manual);
}
async function addBlob(blob, name, { manual = false } = {}) {
  if (blob.size > settings.maxMB * 1048576) { toast(`Ficheiro maior que ${settings.maxMB} MB — não adicionado`); return null; }
  const type = blob.type.startsWith('image/') ? 'image' : 'file';
  const sig = (type === 'image' && await imageSig(blob)) || 'b:' + await sha(blob);
  return addWithSig({ type, blob, name: name || (type === 'image' ? 'imagem' + extOf(blob.type) : 'ficheiro'), mime: blob.type, sig }, manual);
}
// Assinatura pelos píxeis (miniatura 32×32): a mesma imagem recodificada
// pelo clipboard continua a ser reconhecida e não é duplicada.
async function imageSig(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(32, 32);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0, 32, 32);
    const px = g.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < px.length; i++) px[i] &= 0xF0; // tolera pequenas diferenças
    const h = await crypto.subtle.digest('SHA-1', px);
    return `i:${bmp.width}x${bmp.height}:` + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}
const extOf = m => ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' }[m] || '');
async function addWithSig(data, manual) {
  const existing = store.findBySig(data.sig);
  if (existing) {
    if (manual) { toast('Já está no histórico'); flash(existing.id); }
    return existing;
  }
  if (!manual && data.sig === selfSig) return null;
  const it = await store.add(data);
  if (manual) toast('Adicionado');
  return it;
}

async function readClipboard() {
  const nav = curWin().navigator;
  if (nav.clipboard && nav.clipboard.read) {
    const items = await nav.clipboard.read();
    for (const ci of items) {
      const img = ci.types.find(t => t.startsWith('image/'));
      if (img) return { kind: 'image', blob: await ci.getType(img) };
    }
    for (const ci of items) {
      if (ci.types.includes('text/plain')) return { kind: 'text', text: await (await ci.getType('text/plain')).text() };
    }
    return null;
  }
  if (nav.clipboard && nav.clipboard.readText) return { kind: 'text', text: await nav.clipboard.readText() };
  throw new Error('unsupported');
}

async function pasteFromClipboard() {
  try {
    const c = await readClipboard();
    if (!c) return toast('O clipboard está vazio');
    if (c.kind === 'image') await addBlob(c.blob, '', { manual: true });
    else await addText(c.text, { manual: true });
  } catch (e) {
    toast(isMobile ? 'Sem acesso ao clipboard — toca em "Permitir/Colar"' : 'Sem acesso ao clipboard. Prime Ctrl+V dentro da app.');
  }
}

const clipKey = c => !c ? '' : c.kind === 'text' ? 't' + c.text.length + ':' + c.text.slice(0, 64) : 'b' + c.blob.type + ':' + c.blob.size;
// Depois de a app copiar algo, lê o clipboard tal como ficou (o sistema pode
// recodificar imagens) para a captura automática não o voltar a adicionar.
async function rememberSelfCopy() { try { lastRawKey = clipKey(await readClipboard()); } catch { /* sem permissão */ } }

async function autoCapture() {
  if (!settings.autoCapture || settingsOpen) return;
  const w = curWin();
  if (!w.document.hasFocus() || w.document.hidden) return;
  try {
    const c = await readClipboard();
    if (!c) return;
    const key = clipKey(c);
    if (key === lastRawKey) return;
    lastRawKey = key;
    if (c.kind === 'image') await addBlob(c.blob, '');
    else await addText(c.text);
  } catch { /* sem permissão ou sem foco: ignora em silêncio */ }
}

/* ---------- copiar ---------- */
async function toPng(blob) {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  c.getContext('2d').drawImage(bmp, 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}
async function copyItem(it) {
  const w = curWin();
  const clip = w.navigator.clipboard;
  try {
    if (it.type === 'text' || it.type === 'link') {
      await clip.writeText(it.text);
      selfSig = it.sig; lastRawKey = 't' + it.text.length + ':' + it.text.slice(0, 64);
      rememberSelfCopy();
      toast(isMobile ? 'Copiado — agora cola onde quiseres' : 'Copiado — cola com Ctrl+V / ⌘V');
    } else if (it.type === 'image') {
      // O pedido ao clipboard tem de ser imediato (Safari): passamos uma promessa.
      const pngP = store.getBlob(it.id).then(b => { if (!b) throw new Error('Imagem indisponível'); return toPng(b); });
      await clip.write([new w.ClipboardItem({ 'image/png': pngP })]);
      selfSig = it.sig; await pngP; await rememberSelfCopy();
      toast('Imagem copiada — cola onde quiseres');
    } else {
      const b = await store.getBlob(it.id);
      if (!b) throw new Error('Ficheiro indisponível');
      const file = new File([b], it.name || 'ficheiro', { type: it.mime || b.type });
      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Ficheiro descarregado (o navegador não põe ficheiros no clipboard)');
      }
    }
    flash(it.id);
  } catch (e) {
    if (e.name === 'AbortError') return;
    toast('Não foi possível copiar: ' + (e.message || e.name));
  }
}

/* ---------- janela sempre visível (Document Picture-in-Picture) ---------- */
async function togglePip() {
  if (pip) { pip.close(); return; }
  if (!('documentPictureInPicture' in window)) {
    toast(isMobile ? 'No telemóvel o sistema não deixa a app ficar por cima de outras.' : 'Abre a app no Chrome ou Edge para a janela sempre visível.');
    return;
  }
  try {
    pip = await window.documentPictureInPicture.requestWindow({ width: 380, height: 600 });
  } catch (e) { toast('Não foi possível abrir a janela: ' + e.message); return; }
  for (const node of document.head.querySelectorAll('style, link[rel=stylesheet]')) pip.document.head.appendChild(node.cloneNode(true));
  pip.document.title = 'ClipPonte';
  pip.document.body.classList.add('in-pip');
  pip.document.body.appendChild(app);
  attachGlobal(pip.document);
  pip.addEventListener('pagehide', () => {
    document.body.appendChild(app);
    pip = null; pipSize = null;
    app.classList.remove('compact');
    render();
  });
  render();
}

function setCompact(on) {
  app.classList.toggle('compact', on);
  if (pip) {
    try {
      if (on) { pipSize = [pip.outerWidth, pip.outerHeight]; pip.resizeTo(300, 110); }
      else if (pipSize) pip.resizeTo(pipSize[0], pipSize[1]);
    } catch { /* alguns navegadores não deixam redimensionar */ }
  }
  render();
}

/* ---------- interface ---------- */
function wireUI() {
  $('#btnTop').onclick = togglePip;
  $('#btnHide').onclick = () => setCompact(true);
  $('#btnShow').onclick = () => setCompact(false);
  $('#btnSettings').onclick = openSettings;
  $('#syncDot').onclick = openSettings;
  $('#btnPaste').onclick = pasteFromClipboard;
  $('#btnFile').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = async e => { for (const f of e.target.files) await addBlob(f, f.name, { manual: true }); e.target.value = ''; };
  $('#btnInstall').onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#btnInstall').hidden = true; };
  $('#q').oninput = e => { query = e.target.value.trim().toLowerCase(); selIndex = -1; render(); };
  $('#chips').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.f; selIndex = -1;
    for (const c of $('#chips').children) c.classList.toggle('on', c === b);
    render();
  };
  $('#list').onclick = e => {
    const el = e.target.closest('.item'); if (!el) return;
    const it = store.items.get(el.dataset.id); if (!it) return;
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      if (act.dataset.act === 'pin') store.update(it.id, { pinned: !it.pinned });
      if (act.dataset.act === 'del') store.remove(it.id);
      return;
    }
    selIndex = visible.indexOf(it);
    copyItem(it);
  };
  $('#sheet').onclick = e => { if (e.target.id === 'sheet') closeSettings(); };
  $('#banner').onclick = async e => {
    const b = e.target.closest('[data-banner]'); if (!b) return;
    const k = b.dataset.banner;
    if (k === 'perm' && folderNeedsPermission) {
      if (await folderNeedsPermission.ensurePermission(true)) { await store.setBackend(folderNeedsPermission); folderNeedsPermission = null; render(); }
    }
    if (k === 'setup') openSettings();
    if (k === 'dismiss') { settings.hintSeen = true; await saveSettings(); render(); }
  };
}

function attachGlobal(doc) {
  doc.addEventListener('paste', async e => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    const dt = e.clipboardData;
    const files = [...dt.files];
    if (files.length) { for (const f of files) await addBlob(f, f.name && f.name !== 'image.png' ? f.name : '', { manual: true }); return; }
    const text = dt.getData('text/plain');
    if (text) await addText(text, { manual: true });
  });
  doc.addEventListener('keydown', onKey);
  let depth = 0;
  doc.addEventListener('dragenter', e => { e.preventDefault(); depth++; $('#drop').classList.add('show'); });
  doc.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('#drop').classList.remove('show'); } });
  doc.addEventListener('dragover', e => e.preventDefault());
  doc.addEventListener('drop', async e => {
    e.preventDefault(); depth = 0; $('#drop').classList.remove('show');
    const files = [...e.dataTransfer.files];
    if (files.length) { for (const f of files) await addBlob(f, f.name, { manual: true }); return; }
    const text = e.dataTransfer.getData('text/plain');
    if (text) await addText(text, { manual: true });
  });
}

function onKey(e) {
  const typing = e.target.closest && e.target.closest('input, textarea, select');
  if (e.key === 'Escape') {
    if (settingsOpen) return closeSettings();
    if (query) { $('#q').value = ''; query = ''; render(); }
    e.target.blur && e.target.blur();
    return;
  }
  if (typing || settingsOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); return; }
  if (/^[1-9]$/.test(e.key)) { const it = visible[+e.key - 1]; if (it) { selIndex = +e.key - 1; copyItem(it); render(); } return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    selIndex = Math.max(0, Math.min(visible.length - 1, selIndex + (e.key === 'ArrowDown' ? 1 : -1)));
    render();
    const el = $('#list').children[selIndex]; if (el) el.scrollIntoView({ block: 'nearest' });
    return;
  }
  const it = visible[selIndex];
  if (!it) return;
  if (e.key === 'Enter') copyItem(it);
  if (e.key === 'Delete' || e.key === 'Backspace') store.remove(it.id);
  if (e.key.toLowerCase() === 'f') store.update(it.id, { pinned: !it.pinned });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function flash(id) {
  setTimeout(() => {
    const el = $('#list').querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }, 0);
}

function deviceName(it) {
  const d = store.devices.find(x => x.id === it.device);
  if (it.device === device.id) return device.name;
  return d ? d.name : it.deviceName || 'outro dispositivo';
}

function statusInfo() {
  const s = store.status;
  if (folderNeedsPermission) return ['error', 'Falta autorizar o acesso à pasta'];
  if (settings.paused && store.backend) return ['local', 'Sincronização em pausa neste dispositivo'];
  if (!store.backend) return ['local', 'Só neste dispositivo (sem pasta partilhada)'];
  if (s === 'error') return ['error', 'Erro: ' + store.lastError];
  if (s === 'syncing') return ['syncing', 'A sincronizar…'];
  return ['ok', 'Sincronizado com ' + store.backend.label];
}

function render() {
  if (!store) return;
  const [cls, title] = statusInfo();
  for (const id of ['#syncDot', '#syncDot2']) { const d = $(id); d.className = 'dot ' + cls; d.title = title; }
  $('#btnTop').classList.toggle('on', !!pip);
  $('#btnTop').title = pip ? 'Sair do modo sempre visível' : 'Sempre visível (por cima das outras janelas)';

  // banner
  let banner = '';
  if (folderNeedsPermission) {
    banner = `<div class="banner"><span class="grow">Autoriza de novo o acesso à pasta <b>${esc(folderNeedsPermission.label)}</b> para sincronizar.</span><button class="btn primary" data-banner="perm">Autorizar</button></div>`;
  } else if (store.status === 'error' && store.backend) {
    banner = `<div class="banner"><span class="grow">Problema na sincronização: ${esc(store.lastError)}</span><button class="btn" data-banner="setup">Ver</button></div>`;
  } else if (!settings.hintSeen && settings.mode === 'local') {
    banner = `<div class="banner"><span class="grow">Para partilhar com os teus outros dispositivos, escolhe uma pasta do OneDrive.</span><button class="btn primary" data-banner="setup">Configurar</button><button class="ib" data-banner="dismiss" title="Fechar">${I.close}</button></div>`;
  }
  if ($('#banner').innerHTML !== banner) $('#banner').innerHTML = banner;

  // lista
  const hidden = new Set(settings.hiddenDevices);
  visible = store.sorted().filter(it => {
    if (hidden.has(it.device) && it.device !== device.id) return false;
    if (filter === 'pinned' && !it.pinned) return false;
    if (['text', 'link', 'image', 'file'].includes(filter) && it.type !== filter) return false;
    if (query) {
      const hay = (it.text + ' ' + (it.name || '') + ' ' + deviceName(it)).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  // favoritos primeiro
  visible.sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
  if (selIndex >= visible.length) selIndex = visible.length - 1;

  const list = $('#list');
  if (!visible.length) {
    list.innerHTML = store.items.size
      ? `<div class="empty"><b>Nada encontrado</b>Experimenta outro filtro ou pesquisa.</div>`
      : `<div class="empty"><b>Ainda não há nada aqui</b>${isMobile
          ? 'Copia algo noutra app e toca em <b>Colar aqui</b>, ou partilha para o ClipPonte.'
          : 'Copia algo e volta a esta janela, prime <span class="kbd">Ctrl</span>+<span class="kbd">V</span> aqui, ou arrasta ficheiros para esta janela.'}</div>`;
  } else {
    list.innerHTML = visible.map((it, i) => {
      let thumb;
      if (it.type === 'image') thumb = `<div class="thumb" data-thumb="${esc(it.id)}">${thumbs.has(it.id) ? `<img src="${thumbs.get(it.id)}" alt="">` : I.image}</div>`;
      else thumb = `<div class="thumb">${it.type === 'link' ? I.link : it.type === 'file' ? I.file : I.text}</div>`;
      const main = it.type === 'image' || it.type === 'file'
        ? `<div class="txt">${esc(it.name || (it.type === 'image' ? 'Imagem' : 'Ficheiro'))}</div>`
        : `<div class="txt${it.type === 'link' ? ' link' : ''}">${esc(it.text.length > 600 ? it.text.slice(0, 600) + '…' : it.text)}</div>`;
      const extra = it.type === 'image' || it.type === 'file' ? ` · ${fmtSize(it.size)}` : '';
      return `<div class="item${i === selIndex ? ' sel' : ''}" data-id="${esc(it.id)}" title="Clica para copiar">
        ${i < 9 && !isMobile ? `<span class="num">${i + 1}</span>` : ''}
        ${thumb}
        <div class="body">${main}<div class="meta"><span>${esc(deviceName(it))}</span><span>· ${ago(it.createdAt)}${extra}</span></div></div>
        <div class="acts">
          <button class="ib star${it.pinned ? ' on' : ''}" data-act="pin" title="${it.pinned ? 'Tirar dos favoritos' : 'Fixar nos favoritos'}">${it.pinned ? I.starFill : I.star}</button>
          <button class="ib" data-act="del" title="Apagar">${I.trash}</button>
        </div></div>`;
    }).join('');
    loadThumbs();
  }
  $('#compactLabel').textContent = `ClipPonte · ${store.items.size} ${store.items.size === 1 ? 'item' : 'itens'}`;
  if (settingsOpen) renderSettingsDevices();
}

async function loadThumbs() {
  for (const el of $('#list').querySelectorAll('[data-thumb]')) {
    const id = el.dataset.thumb;
    if (thumbs.has(id)) continue;
    thumbs.set(id, null);
    try {
      const b = await store.getBlob(id);
      if (!b) { thumbs.delete(id); continue; }
      const url = URL.createObjectURL(b);
      thumbs.set(id, url);
      const cur = $('#list').querySelector(`[data-thumb="${CSS.escape(id)}"]`);
      if (cur) cur.innerHTML = `<img src="${url}" alt="">`;
    } catch { thumbs.delete(id); }
  }
}

/* ---------- definições ---------- */
function openSettings() { settingsOpen = true; renderSettings(); $('#sheet').classList.add('show'); }
function closeSettings() { settingsOpen = false; settingsErr = ''; $('#sheet').classList.remove('show'); render(); }

function renderSettings() {
  const panel = $('#settingsPanel');
  const folderOK = FolderBackend.supported();
  const redirect = location.origin + location.pathname;
  panel.innerHTML = `
    <div class="row" style="padding-top:0"><h2>Definições</h2><button class="ib" id="sClose" title="Fechar">${I.close}</button></div>
    ${settingsErr ? `<p class="err">${esc(settingsErr)}</p>` : ''}

    <h3>Este dispositivo</h3>
    <div class="card">
      <div class="row"><div class="grow"><input class="field" id="sName" value="${esc(device.name)}" aria-label="Nome do dispositivo"><small style="margin-top:4px">Nome que aparece nos outros dispositivos</small></div></div>
      <label class="row"><div class="grow">Sincronizar este dispositivo<small>Desliga para pausar o envio e a receção</small></div><input type="checkbox" id="sSync" ${settings.paused ? '' : 'checked'}></label>
      <label class="row"><div class="grow">Captura automática<small>${isMobile ? 'No telemóvel o sistema pede autorização a cada leitura — recomendado desligado' : 'Guarda o que copias sempre que voltas à janela da app'}</small></div><input type="checkbox" id="sAuto" ${settings.autoCapture ? 'checked' : ''}></label>
    </div>

    <h3>Onde guardar o histórico</h3>
    <div class="seg">
      <label class="opt ${settings.mode === 'local' ? 'on' : ''}"><input type="radio" name="mode" value="local" ${settings.mode === 'local' ? 'checked' : ''}><div>Só neste dispositivo<small>Sem partilha entre dispositivos</small></div></label>
      <label class="opt ${settings.mode === 'folder' ? 'on' : ''}"><input type="radio" name="mode" value="folder" ${settings.mode === 'folder' ? 'checked' : ''} ${folderOK ? '' : 'disabled'}><div>Pasta partilhada (PC)<small>${folderOK ? 'Escolhe uma pasta dentro do OneDrive, por exemplo <b>OneDrive/ClipPonte</b>' : 'Disponível no Chrome ou Edge no PC'}</small>
        ${settings.mode === 'folder' ? `<div class="sub"><button class="btn" id="sPick">${store.backend && store.backend.kind === 'folder' ? 'Pasta: ' + esc(store.backend.label) + ' — mudar' : 'Escolher pasta…'}</button></div>` : ''}
      </div></label>
      <label class="opt ${settings.mode === 'onedrive' ? 'on' : ''}"><input type="radio" name="mode" value="onedrive" ${settings.mode === 'onedrive' ? 'checked' : ''}><div>OneDrive (conta Microsoft)<small>Para telemóveis. Usa a mesma pasta que escolheste no PC.</small>
        ${settings.mode === 'onedrive' ? `<div class="sub">
          <input class="field" id="sClient" placeholder="ID da aplicação (Client ID)" value="${esc(settings.clientId)}">
          <input class="field" id="sFolder" placeholder="Pasta no OneDrive" value="${esc(settings.odFolder)}">
          <div class="help">Redirect URI a registar: <b>${esc(redirect)}</b></div>
          <div class="row" style="padding:0;gap:8px"><button class="btn primary" id="sLogin">${store.backend && store.backend.kind === 'onedrive' ? 'Entrar com outra conta' : 'Entrar na Microsoft'}</button>
          ${store.backend && store.backend.kind === 'onedrive' ? '<button class="btn" id="sLogout">Sair</button>' : ''}</div>
        </div>` : ''}
      </div></label>
    </div>

    <h3>Dispositivos</h3>
    <div class="card" id="sDevices"></div>

    <h3>Histórico</h3>
    <div class="card">
      <label class="row"><div class="grow">Guardar durante<small>Os favoritos (★) nunca são apagados</small></div>
        <select class="field" id="sRet" style="width:auto">${[1, 7, 30, 90].map(d => `<option value="${d}" ${settings.retentionDays === d ? 'selected' : ''}>${d} ${d === 1 ? 'dia' : 'dias'}</option>`).join('')}</select></label>
      <label class="row"><div class="grow">Tamanho máximo por ficheiro</div>
        <select class="field" id="sMax" style="width:auto">${[5, 25, 100].map(m => `<option value="${m}" ${settings.maxMB === m ? 'selected' : ''}>${m} MB</option>`).join('')}</select></label>
      <div class="row"><div class="grow">Apagar tudo exceto favoritos</div><button class="btn danger" id="sClear">Limpar</button></div>
    </div>

    ${isMobile ? '' : `<h3>Atalhos</h3>
    <div class="card help" style="line-height:1.9">
      <span class="kbd">1</span>…<span class="kbd">9</span> copiar item · <span class="kbd">↑</span><span class="kbd">↓</span> escolher · <span class="kbd">Enter</span> copiar<br>
      <span class="kbd">F</span> favorito · <span class="kbd">Del</span> apagar · <span class="kbd">/</span> pesquisar · <span class="kbd">Ctrl</span>+<span class="kbd">V</span> adicionar
    </div>`}
    <p class="help" style="margin-top:16px">ClipPonte · os dados ficam no teu dispositivo e na pasta que escolheres.</p>`;
  renderSettingsDevices();

  const q = s => panel.querySelector(s);
  q('#sClose').onclick = closeSettings;
  q('#sName').onchange = async e => { device.name = e.target.value.trim() || device.name; await kv.set('device', device); store.device = device; await store.announceDevice().catch(() => {}); render(); };
  q('#sSync').onchange = async e => { settings.paused = !e.target.checked; store.paused = settings.paused; await saveSettings(); if (!settings.paused) store.sync(true); render(); };
  q('#sAuto').onchange = async e => { settings.autoCapture = e.target.checked; await saveSettings(); };
  for (const r of panel.querySelectorAll('input[name=mode]')) r.onchange = async e => {
    settings.mode = e.target.value; settingsErr = ''; await saveSettings();
    if (settings.mode === 'local') await connect(true);
    else if (settings.mode === 'folder') { if (await kv.get('folderHandle')) await connect(true); }
    else await connect(true);
    renderSettings();
  };
  if (q('#sPick')) q('#sPick').onclick = e => { e.preventDefault(); chooseFolder(); };
  if (q('#sClient')) {
    q('#sClient').onchange = async e => { settings.clientId = e.target.value.trim(); await saveSettings(); };
    q('#sFolder').onchange = async e => { settings.odFolder = e.target.value.trim().replace(/^\/+|\/+$/g, '') || 'ClipPonte'; await saveSettings(); await connect(true); renderSettings(); };
    q('#sLogin').onclick = async e => {
      e.preventDefault();
      settings.clientId = q('#sClient').value.trim();
      if (!settings.clientId) { settingsErr = 'Indica o ID da aplicação (ver guia).'; return renderSettings(); }
      await saveSettings();
      new GraphAuth(settings.clientId).login();
    };
    if (q('#sLogout')) q('#sLogout').onclick = async e => { e.preventDefault(); await new GraphAuth(settings.clientId).logout(); await connect(false); renderSettings(); };
  }
  q('#sRet').onchange = async e => { settings.retentionDays = +e.target.value; store.retentionDays = settings.retentionDays; await saveSettings(); store.purge(); };
  q('#sMax').onchange = async e => { settings.maxMB = +e.target.value; await saveSettings(); };
  q('#sClear').onclick = async () => {
    if (!curWin().confirm('Apagar todos os itens que não estão nos favoritos? Também desaparecem dos outros dispositivos.')) return;
    for (const it of store.sorted()) if (!it.pinned) await store.remove(it.id);
    toast('Histórico limpo');
  };
}

function renderSettingsDevices() {
  const box = $('#sDevices'); if (!box) return;
  const list = [...store.devices];
  if (!list.find(d => d.id === device.id)) list.unshift({ ...device, lastSeen: Date.now() });
  list.sort((a, b) => (b.id === device.id) - (a.id === device.id) || (b.lastSeen || 0) - (a.lastSeen || 0));
  const hidden = new Set(settings.hiddenDevices);
  const html = (store.backend ? '' : '<p class="help" style="margin:0 0 6px">Liga uma pasta partilhada para veres os outros dispositivos.</p>') +
    list.map(d => {
      const me = d.id === device.id;
      return `<div class="row" data-dev="${esc(d.id)}">
        <input type="checkbox" data-show ${hidden.has(d.id) ? '' : 'checked'} ${me ? 'disabled checked' : ''} title="Mostrar os itens deste dispositivo">
        <div class="grow">${esc(me ? device.name : d.name)}${me ? ' <b style="color:var(--accent)">(este)</b>' : ''}<small>${esc(d.platform || '')} · ${me ? 'ativo agora' : 'visto ' + ago(d.lastSeen || 0)}</small></div>
        ${me ? '' : `<button class="ib" data-rm title="Remover dispositivo">${I.trash}</button>`}
      </div>`;
    }).join('');
  if (box.innerHTML === html) return;
  box.innerHTML = html;
  box.onchange = async e => {
    const row = e.target.closest('[data-dev]'); if (!row || !e.target.matches('[data-show]')) return;
    const id = row.dataset.dev;
    const set = new Set(settings.hiddenDevices);
    e.target.checked ? set.delete(id) : set.add(id);
    settings.hiddenDevices = [...set]; await saveSettings(); render();
  };
  box.onclick = async e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const id = b.closest('[data-dev]').dataset.dev;
    const d = store.devices.find(x => x.id === id);
    if (!curWin().confirm(`Remover "${d ? d.name : 'dispositivo'}" da lista e apagar os itens que copiou?`)) return;
    await store.removeDevice(id, true);
    toast('Dispositivo removido');
  };
}

/* ---------- partilhar para a app (Android) ---------- */
async function importInbox() {
  let entries;
  try { entries = await idb.entries('inbox'); } catch { return; }
  if (!entries.length) return;
  for (const [key, v] of entries) {
    for (const f of v.files || []) await addBlob(f, f.name, { manual: true });
    const text = [v.title, v.text, v.url].filter(Boolean).join('\n').trim();
    if (text && !(v.files || []).length) await addText(v.url && !v.text ? v.url : text, { manual: true });
    await idb.del('inbox', key);
  }
}

// Ganchos de teste (usados só pelos testes automáticos).
window.__cp = {
  get store() { return store; },
  async useTestFolder(name = 'shared') {
    const root = await navigator.storage.getDirectory();
    const sub = await root.getDirectoryHandle(name, { create: true });
    await store.setBackend(new FolderBackend(sub), true);
    render();
  },
  addText: t => addText(t, { manual: true }),
  autoCapture: () => autoCapture(),
  readClipboard: () => readClipboard(),
  addBlob: (b, n) => addBlob(b, n, { manual: true }),
};

boot().catch(e => { console.error(e); toast('Erro ao iniciar: ' + e.message); });
