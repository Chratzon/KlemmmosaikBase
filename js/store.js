/* KlemmmosaikBase – Projekt lokal speichern (IndexedDB, Fallback: nur im Speicher) */
(function () {
  "use strict";
  const DB = "klemmmosaikbase", STORE = "kv";
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  const mem = new Map();
  KM.store = {
    async get(k) {
      try { const db = await open(); return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
      catch (e) { return mem.get(k); }
    },
    async set(k, v) {
      mem.set(k, v);
      try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
      catch (e) { /* nur im Speicher */ }
    },
    async del(k) {
      mem.delete(k);
      try { const db = await open(); await new Promise((res) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(k); t.oncomplete = res; t.onerror = res; }); }
      catch (e) {}
    }
  };
})();
