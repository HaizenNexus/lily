/** Estado do app. Persistência em IndexedDB (com fallback para localStorage) e migração automática dos dados da versão anterior. */
const LS_KEY = 'lily:v1', DB_NAME = 'lily';
const defaults = {
  settings: { userName: 'Evellin', expressions: true, tone: 'carinhosa', useMemories: true },
  convs: [], currentId: null, items: [], memories: []
};
export const state = structuredClone(defaults);
let db = null;

const open = () => new Promise(resolve => {
  if (!('indexedDB' in globalThis)) return resolve(null);
  try {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('convs', { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = r.onblocked = () => resolve(null);
  } catch { resolve(null); }
});
const wrap = r => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });

async function flush() {
  const lsFallback = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignora */ } };
  if (!db) return lsFallback();
  const { convs, ...meta } = state;
  try {
    await new Promise((ok, fail) => {
      const tx = db.transaction(['meta', 'convs'], 'readwrite');
      tx.objectStore('meta').put(meta, 'state');
      const cs = tx.objectStore('convs'); cs.clear(); convs.forEach(c => cs.put(c));
      tx.oncomplete = ok; tx.onerror = tx.onabort = () => fail(tx.error);
    });
  } catch { lsFallback(); }
}

async function load() {
  db = await open();
  let data = null, migrated = false;
  if (db) {
    try {
      const tx = db.transaction(['meta', 'convs']);
      const [meta, convs] = await Promise.all([wrap(tx.objectStore('meta').get('state')), wrap(tx.objectStore('convs').getAll())]);
      if (meta || convs.length) data = { ...meta, convs };
    } catch { /* segue para localStorage */ }
  }
  if (!data) { try { data = JSON.parse(localStorage.getItem(LS_KEY)); migrated = Boolean(data); } catch { /* sem dados */ } }
  if (data) {
    Object.assign(state, data, { settings: { ...defaults.settings, ...data.settings } });
    state.convs.sort((a, b) => b.updated - a.updated);
  }
  if (migrated && db) { await flush(); try { localStorage.removeItem(LS_KEY); } catch { /* ignora */ } }
  try { navigator.storage?.persist?.(); } catch { /* ignora */ }
}

let timer;
export const save = () => { clearTimeout(timer); timer = setTimeout(flush, 250); };
const flushNow = () => { clearTimeout(timer); flush(); };
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
addEventListener('pagehide', flushNow);

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
export function newConv(title = 'Nova conversa') {
  const c = { id: uid(), title, messages: [], updated: Date.now() };
  state.convs.unshift(c); state.currentId = c.id; save();
  return c;
}
export const current = () => state.convs.find(c => c.id === state.currentId);
export function resetAll() {
    clearTimeout(timer);

    if (db) {
        db.close();
        db = null;
    }

    try {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem('lily:code');
    } catch (error) {
        console.error('Erro ao limpar armazenamento:', error);
    }

    if (!('indexedDB' in globalThis)) {
        location.reload();
        return;
    }

    const r = indexedDB.deleteDatabase(DB_NAME);

    r.onsuccess = () => {
        location.reload();
    };

    r.onerror = () => {
        console.error('Erro ao excluir IndexedDB:', r.error);
        alert('Não foi possível limpar os dados. Tente novamente.');
    };

    r.onblocked = () => {
        alert('A limpeza está aguardando. Feche outras abas da LILY.');
    };
}


await load();
