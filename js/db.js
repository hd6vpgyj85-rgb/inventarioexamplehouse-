const DB_NAME = 'despensa';
const DB_VERSION = 1;
const STORES = {
  products: { keyPath: 'id', indexes: [['nombre', 'nombre'], ['categoria', 'categoria']] },
  purchases: { keyPath: 'id', indexes: [['fecha', 'fecha']] },
  shopping: { keyPath: 'id', indexes: [['productId', 'productId']] },
  settings: { keyPath: 'key', indexes: [] }
};

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, cfg] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: cfg.keyPath });
        cfg.indexes.forEach(([idx, path]) => store.createIndex(idx, path));
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    if (req) {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } else {
      t.oncomplete = () => resolve();
    }
  });
}

export const db = {
  getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
  get: (store, key) => tx(store, 'readonly', (s) => s.get(key)),
  put: (store, value) => tx(store, 'readwrite', (s) => s.put(value)),
  del: (store, key) => tx(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
  async bulkPut(store, values) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const t = database.transaction(store, 'readwrite');
      const os = t.objectStore(store);
      values.forEach((v) => os.put(v));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
};

export const STORE_NAMES = Object.keys(STORES);
