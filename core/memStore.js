// Хранилище в памяти (тесты, демо в браузере). Тот же интерфейс, что у SQLite-хранилища сервера.
import { uid, nowIso } from './util.js';

export class MemStore {
  constructor(snapshot, onChange) {
    this.data = snapshot?.data || {};   // ws -> coll -> id -> doc
    this.workspaces = snapshot?.workspaces || {};
    this.onChange = onChange || null;
  }
  _c(ws, coll) { return ((this.data[ws] ||= {})[coll] ||= {}); }
  _changed() { if (this.onChange) this.onChange(this.snapshot()); }
  snapshot() { return { data: this.data, workspaces: this.workspaces }; }
  list(ws, coll) { return Object.values(this._c(ws, coll)).map(d => structuredClone(d)); }
  get(ws, coll, id) { const d = this._c(ws, coll)[id]; return d ? structuredClone(d) : null; }
  put(ws, coll, doc) { this._c(ws, coll)[doc.id] = structuredClone(doc); this._changed(); return doc; }
  del(ws, coll, id) { delete this._c(ws, coll)[id]; this._changed(); }
  createWorkspace(w) {
    const ws = { id: uid('w_'), plan: 'pro', credits: 1200, kind: 'own', createdAt: nowIso(), ...w };
    this.workspaces[ws.id] = ws; this._changed(); return structuredClone(ws);
  }
  getWorkspace(id) { const w = this.workspaces[id]; return w ? structuredClone(w) : null; }
  saveWorkspace(ws) { this.workspaces[ws.id] = structuredClone(ws); this._changed(); return ws; }
  listWorkspaces() { return Object.values(this.workspaces).map(w => structuredClone(w)); }
}
