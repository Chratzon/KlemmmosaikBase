/* KlemmmosaikBase – Projekte und Versionen
   Ablage in IndexedDB (über KM.store):
     "projects"          Liste: [{ id, name, created, updated, thumb, versions: [{ id, name, created, updated, thumb }] }]
     "img:<pid>"         Bild des Projekts als Data-URL
     "ver:<pid>:<vid>"   { settings, edits, editSig } einer Version
     "current"           { pid, vid } zuletzt geöffnet */
(function () {
  "use strict";
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  let cache = null;
  async function all() { if (!cache) cache = (await KM.store.get("projects")) || []; return cache; }
  async function persist() { await KM.store.set("projects", cache); }
  const find = (list, id) => list.find((x) => x.id === id);

  KM.projects = {
    async list() { return (await all()).slice().sort((a, b) => b.updated - a.updated); },
    async get(pid) { return find(await all(), pid); },
    async current() { return KM.store.get("current"); },
    async setCurrent(pid, vid) {
      await KM.store.set("current", { pid, vid });
      const p = find(await all(), pid); if (p && p.lastVid !== vid) { p.lastVid = vid; await persist(); }
    },

    async create(name, imgUrl, data) {
      const list = await all(), now = Date.now();
      const p = { id: uid(), name, created: now, updated: now, thumb: null, versions: [{ id: uid(), name: "Version 1", created: now, updated: now, thumb: null }] };
      list.push(p);
      await KM.store.set("img:" + p.id, imgUrl);
      await KM.store.set(`ver:${p.id}:${p.versions[0].id}`, data);
      await persist(); await this.setCurrent(p.id, p.versions[0].id);
      return { pid: p.id, vid: p.versions[0].id };
    },
    async image(pid) { return KM.store.get("img:" + pid); },
    async version(pid, vid) { return KM.store.get(`ver:${pid}:${vid}`); },

    async save(pid, vid, data, thumb) {
      const p = await this.get(pid); if (!p) return;
      const v = find(p.versions, vid); if (!v) return;
      await KM.store.set(`ver:${pid}:${vid}`, data);
      const now = Date.now();
      v.updated = now; p.updated = now;
      if (thumb) { v.thumb = thumb; p.thumb = thumb; }
      await persist();
    },
    async addVersion(pid, data, thumb) {
      const p = await this.get(pid); if (!p) return null;
      const now = Date.now();
      let n = p.versions.length + 1; while (p.versions.some((v) => v.name === "Version " + n)) n++;
      const v = { id: uid(), name: "Version " + n, created: now, updated: now, thumb: thumb || null };
      p.versions.push(v); p.updated = now;
      await KM.store.set(`ver:${pid}:${v.id}`, data);
      await persist(); await this.setCurrent(pid, v.id);
      return v.id;
    },
    async renameProject(pid, name) { const p = await this.get(pid); if (p && name.trim()) { p.name = name.trim(); await persist(); } },
    async renameVersion(pid, vid, name) { const p = await this.get(pid); const v = p && find(p.versions, vid); if (v && name.trim()) { v.name = name.trim(); await persist(); } },
    async deleteVersion(pid, vid) {
      const p = await this.get(pid); if (!p || p.versions.length <= 1) return false;
      p.versions = p.versions.filter((v) => v.id !== vid);
      await KM.store.del(`ver:${pid}:${vid}`); await persist();
      return true;
    },
    async deleteProject(pid) {
      const list = await all(), p = find(list, pid); if (!p) return;
      for (const v of p.versions) await KM.store.del(`ver:${pid}:${v.id}`);
      await KM.store.del("img:" + pid);
      cache = list.filter((x) => x.id !== pid); await persist();
    }
  };
})();
