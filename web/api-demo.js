// Демо-API: та же бизнес-логика (core/router.js), хранилище — в памяти браузера + localStorage.
import { handle } from '../core/router.js';
import { MemStore } from '../core/memStore.js';
import { seedDemo, mockServices } from '../core/seed.js';
import { HttpError, nowIso } from '../core/util.js';

const KEY = 'leadmeet-demo-v1';

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function demoApi() {
  let snapshot = null;
  try { snapshot = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { snapshot = null; }
  const persist = (snap) => { try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* хранилище может быть недоступно */ } };
  let store = new MemStore(snapshot, persist);
  let audit = snapshot?.audit || [];
  let loggedIn = (() => { try { return sessionStorage.getItem('lm-demo-in') === '1'; } catch { return false; } })();
  let wsId = null;
  const user = { id: 'u_demo', email: 'demo@leadmeet.local', name: 'Влад (демо)' };
  let ready = null;

  async function addAudit(e) {
    const prev = audit.length ? audit[audit.length - 1].hash : 'GENESIS';
    const entry = { seq: audit.length + 1, at: nowIso(), ws: e.ws, user: e.user, action: e.action, data: e.data ?? null, prev };
    entry.hash = await sha256(prev + '|' + entry.at + '|' + entry.ws + '|' + (entry.user || '') + '|' + entry.action + '|' + JSON.stringify(entry.data));
    audit.push(entry);
    if (audit.length > 500) audit = audit.slice(-500);
    persist({ ...store.snapshot(), audit });
  }
  store.onChange = (snap) => persist({ ...snap, audit });

  function ctxFor() {
    const ws = store.getWorkspace(wsId);
    const ctx = { store, ws, user, role: 'owner', demo: true, workspaces: store.listWorkspaces().map(w => ({ id: w.id, name: w.name, kind: w.kind, role: 'owner' })) };
    ctx.services = mockServices({
      auditVerify: async () => {
        let prev = 'GENESIS', broken = null;
        for (const a of audit) { const h = await sha256(a.prev + '|' + a.at + '|' + a.ws + '|' + (a.user || '') + '|' + a.action + '|' + JSON.stringify(a.data)); if (a.prev !== prev || a.hash !== h) { broken = a.seq; break; } prev = a.hash; }
        return { ok: broken === null, entries: audit.length, head: prev, brokenAt: broken, note: 'Демо: цепочка хранится в браузере.' };
      },
      auditList: async (c, n) => audit.filter(a => a.ws === c.ws.id).slice(-n).reverse(),
      testChannel: async (c, type) => ({ ok: true, message: `Демо: канал «${type}» сохранён. На сервере здесь будет реальная проверка подключения.` }),
    });
    ctx.audit = addAudit;
    return ctx;
  }

  async function ensure() {
    if (ready) return ready;
    ready = (async () => {
      const list = store.listWorkspaces();
      if (!list.length) {
        const ws = store.createWorkspace({ name: 'LEADMEET · демо', plan: 'agency', credits: 5000, kind: 'own' });
        wsId = ws.id;
        await seedDemo(ctxFor());
      } else wsId = (() => { try { return sessionStorage.getItem('lm-demo-ws'); } catch { return null; } })() || list.find(w => w.kind === 'own')?.id || list[0].id;
      if (!store.getWorkspace(wsId)) wsId = store.listWorkspaces()[0].id;
    })();
    return ready;
  }

  async function call(method, path, body) {
    await ensure();
    if (!loggedIn) { const e = new Error('Войдите в систему.'); e.status = 401; throw e; }
    const [p, qs] = path.split('?');
    try {
      return structuredClone(await handle(ctxFor(), method, p, body || {}, Object.fromEntries(new URLSearchParams(qs || ''))));
    } catch (e) {
      if (e instanceof HttpError) { const err = new Error(e.message); err.status = e.status; throw err; }
      throw e;
    }
  }
  const setIn = (v) => { loggedIn = v; try { sessionStorage.setItem('lm-demo-in', v ? '1' : '0'); } catch { /* ignore */ } };
  const auth = {
    state: async () => ({ hasUsers: true, allowSignup: true, demoMode: true, oauth: {} }),
    login: async () => { await ensure(); setIn(true); return { ok: true }; },
    register: async () => { await ensure(); setIn(true); return { ok: true }; },
    demo: async () => { await ensure(); setIn(true); return { ok: true }; },
    logout: async () => { setIn(false); return { ok: true }; },
    logoutAll: async () => { setIn(false); return { ok: true }; },
    switch: async (id) => { wsId = id; try { sessionStorage.setItem('lm-demo-ws', id); } catch { /* ignore */ } return { ok: true }; },
    totpSetup: async () => { throw new Error('2FA доступна в серверной версии.'); },
    totpEnable: async () => ({ ok: false }),
    password: async () => { throw new Error('В демо пароля нет.'); },
    invite: async () => { throw new Error('Приглашения доступны в серверной версии.'); },
    members: async () => [],
  };
  return {
    mode: 'demo', call, auth,
    uploadAudio: async () => { throw new Error('В демо аудио не распознаётся — вставьте текст расшифровки. На сервере подключается Whisper или Deepgram.'); },
    exportSnapshot: () => JSON.stringify({ ...store.snapshot(), audit }, null, 1),
    reset: async () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem('lm-demo-ws'); } catch { /* ignore */ } store = new MemStore(null, (s) => persist({ ...s, audit })); audit = []; ready = null; await ensure(); },
  };
}
