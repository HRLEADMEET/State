// SQLite-хранилище (встроенный node:sqlite, без внешних зависимостей). WAL-журнал, внешние ключи,
// документная модель для бизнес-данных + отдельные таблицы для пользователей, сессий и аудита.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { config } from './config.js';
import { uid, nowIso } from '../core/util.js';
import { chainHash } from './security.js';

export function openDb(file = path.join(config.dataDir, 'leadmeet.db')) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS docs (ws TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY (ws, coll, id));
    CREATE INDEX IF NOT EXISTS docs_coll ON docs (coll);
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS members (ws TEXT NOT NULL, user TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (ws, user));
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user TEXT NOT NULL, ws TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL, ip TEXT, ua TEXT, created TEXT);
    CREATE TABLE IF NOT EXISTS invites (token TEXT PRIMARY KEY, ws TEXT NOT NULL, role TEXT NOT NULL, email TEXT, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, ws TEXT, user TEXT, action TEXT NOT NULL, data TEXT, prev TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
  `);
  return db;
}

export class SqliteStore {
  constructor(db) { this.db = db; this._stmts = {}; }
  q(sql) { return (this._stmts[sql] ||= this.db.prepare(sql)); }

  list(ws, coll) { return this.q('SELECT data FROM docs WHERE ws = ? AND coll = ?').all(ws, coll).map(r => JSON.parse(r.data)); }
  get(ws, coll, id) { const r = this.q('SELECT data FROM docs WHERE ws = ? AND coll = ? AND id = ?').get(ws, coll, id); return r ? JSON.parse(r.data) : null; }
  put(ws, coll, doc) { this.q('INSERT INTO docs (ws, coll, id, data, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(ws, coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated').run(ws, coll, doc.id, JSON.stringify(doc), nowIso()); return doc; }
  del(ws, coll, id) { this.q('DELETE FROM docs WHERE ws = ? AND coll = ? AND id = ?').run(ws, coll, id); }
  findChannelByHookKey(key) { const r = this.q("SELECT ws, data FROM docs WHERE coll = 'channels' AND json_extract(data, '$.hookKey') = ?").get(key); return r ? { ws: r.ws, channel: JSON.parse(r.data) } : null; }
  allOf(coll) { return this.q('SELECT ws, data FROM docs WHERE coll = ?').all(coll).map(r => ({ ws: r.ws, doc: JSON.parse(r.data) })); }

  createWorkspace(w) {
    const ws = { id: uid('w_'), plan: 'pro', credits: 1200, kind: 'own', createdAt: nowIso(), ...w };
    this.q('INSERT INTO workspaces (id, data) VALUES (?, ?)').run(ws.id, JSON.stringify(ws));
    if (w.ownerUserId) this.addMember(ws.id, w.ownerUserId, 'owner');
    return ws;
  }
  getWorkspace(id) { const r = this.q('SELECT data FROM workspaces WHERE id = ?').get(id); return r ? JSON.parse(r.data) : null; }
  saveWorkspace(ws) { this.q('UPDATE workspaces SET data = ? WHERE id = ?').run(JSON.stringify(ws), ws.id); return ws; }
  listWorkspaces() { return this.q('SELECT data FROM workspaces').all().map(r => JSON.parse(r.data)); }

  // users & members
  createUser(u) { const user = { id: uid('u_'), createdAt: nowIso(), ...u, email: String(u.email).toLowerCase() }; this.q('INSERT INTO users (id, email, data) VALUES (?, ?, ?)').run(user.id, user.email, JSON.stringify(user)); return user; }
  saveUser(u) { this.q('UPDATE users SET data = ?, email = ? WHERE id = ?').run(JSON.stringify(u), u.email, u.id); return u; }
  userByEmail(email) { const r = this.q('SELECT data FROM users WHERE email = ?').get(String(email).toLowerCase()); return r ? JSON.parse(r.data) : null; }
  userById(id) { const r = this.q('SELECT data FROM users WHERE id = ?').get(id); return r ? JSON.parse(r.data) : null; }
  countUsers() { return this.q('SELECT COUNT(*) n FROM users').get().n; }
  addMember(ws, user, role) { this.q('INSERT INTO members (ws, user, role) VALUES (?, ?, ?) ON CONFLICT(ws, user) DO UPDATE SET role = excluded.role').run(ws, user, role); }
  memberRole(ws, user) { return this.q('SELECT role FROM members WHERE ws = ? AND user = ?').get(ws, user)?.role || null; }
  workspacesOf(user) { return this.q('SELECT w.data, m.role FROM members m JOIN workspaces w ON w.id = m.ws WHERE m.user = ?').all(user).map(r => ({ ...JSON.parse(r.data), role: r.role })); }
  membersOf(ws) { return this.q('SELECT u.data, m.role FROM members m JOIN users u ON u.id = m.user WHERE m.ws = ?').all(ws).map(r => { const u = JSON.parse(r.data); return { id: u.id, email: u.email, name: u.name, role: r.role }; }); }

  // sessions
  createSession(s) { this.q('INSERT INTO sessions (id, user, ws, csrf, expires, ip, ua, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(s.id, s.user, s.ws, s.csrf, s.expires, s.ip || '', s.ua || '', nowIso()); }
  session(id) { return this.q('SELECT * FROM sessions WHERE id = ?').get(id) || null; }
  setSessionWs(id, ws) { this.q('UPDATE sessions SET ws = ? WHERE id = ?').run(ws, id); }
  deleteSession(id) { this.q('DELETE FROM sessions WHERE id = ?').run(id); }
  deleteUserSessions(user) { this.q('DELETE FROM sessions WHERE user = ?').run(user); }
  purgeSessions() { this.q('DELETE FROM sessions WHERE expires < ?').run(Date.now()); }

  // invites
  createInvite(i) { this.q('INSERT INTO invites (token, ws, role, email, expires) VALUES (?, ?, ?, ?, ?)').run(i.token, i.ws, i.role, i.email || '', i.expires); }
  invite(t) { return this.q('SELECT * FROM invites WHERE token = ? AND expires > ?').get(t, Date.now()) || null; }
  deleteInvite(t) { this.q('DELETE FROM invites WHERE token = ?').run(t); }

  // kv
  kvGet(k) { const r = this.q('SELECT v FROM kv WHERE k = ?').get(k); return r ? JSON.parse(r.v) : null; }
  kvSet(k, v) { this.q('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v)); }

  // audit hash-chain
  audit({ ws = null, user = null, action, data = null }) {
    const last = this.q('SELECT hash FROM audit ORDER BY seq DESC LIMIT 1').get();
    const prev = last?.hash || 'GENESIS';
    const entry = { at: nowIso(), ws, user, action, data };
    const hash = chainHash(prev, entry);
    this.q('INSERT INTO audit (at, ws, user, action, data, prev, hash) VALUES (?, ?, ?, ?, ?, ?, ?)').run(entry.at, ws, user, action, JSON.stringify(data), prev, hash);
    return hash;
  }
  auditVerify(ws) {
    const rows = this.q('SELECT * FROM audit ORDER BY seq').all();
    let prev = 'GENESIS', broken = null;
    for (const r of rows) {
      const h = chainHash(prev, { at: r.at, ws: r.ws, user: r.user, action: r.action, data: JSON.parse(r.data) });
      if (r.prev !== prev || r.hash !== h) { broken = r.seq; break; }
      prev = r.hash;
    }
    return { ok: broken === null, entries: rows.length, wsEntries: ws ? rows.filter(r => r.ws === ws).length : undefined, head: prev, brokenAt: broken };
  }
  auditList(ws, limit = 100) { return this.q('SELECT seq, at, user, action, data, hash FROM audit WHERE ws = ? ORDER BY seq DESC LIMIT ?').all(ws, limit).map(r => ({ ...r, data: JSON.parse(r.data) })); }
}
