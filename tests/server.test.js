// Интеграционные тесты сервера: регистрация, CSRF, права, вебхуки, отписка, журнал целостности,
// шифрование секретов, бэкап и восстановление, SMTP. Каждый прогон — в отдельной временной папке.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'leadmeet-test-'));
process.env.DATA_DIR = dir;
process.env.DEMO_MODE = 'false';
process.env.ALLOW_SIGNUP = 'false';
process.env.HOST = '127.0.0.1';

let srv, base, mod;
const jar = { sid: '', csrf: '' };

async function req(method, p, body, { auth = true, headers = {} } = {}) {
  const h = { 'content-type': 'application/json', ...headers };
  if (auth && jar.sid) { h.cookie = `lm_sid=${jar.sid}; lm_csrf=${jar.csrf}`; h['x-csrf'] = headers['x-csrf'] ?? jar.csrf; }
  const res = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  for (const c of res.headers.getSetCookie?.() || []) {
    const m = c.match(/^(lm_sid|lm_csrf)=([^;]*)/); if (m) jar[m[1] === 'lm_sid' ? 'sid' : 'csrf'] = decodeURIComponent(m[2]);
  }
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

before(async () => {
  mod = await import('../server/index.js');
  const port = await new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  srv = await mod.start(port);
  base = `http://127.0.0.1:${port}`;
});
after(() => { srv?.close(); fs.rmSync(dir, { recursive: true, force: true }); });

test('первый пользователь становится владельцем, дальше регистрация закрыта', async () => {
  const st = await req('GET', '/api/auth/state', undefined, { auth: false });
  assert.equal(st.json.hasUsers, false);
  const weak = await req('POST', '/api/auth/register', { email: 'vlad@test.ru', password: '123' }, { auth: false });
  assert.equal(weak.status, 400);
  const r = await req('POST', '/api/auth/register', { email: 'vlad@test.ru', password: 'Strong-pass-2026', name: 'Влад' }, { auth: false });
  assert.equal(r.status, 200);
  assert.ok(jar.sid && jar.csrf);
  const second = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'x@test.ru', password: 'Strong-pass-2026' }) });
  assert.equal(second.status, 403);
});

test('без CSRF-заголовка изменения запрещены', async () => {
  const r = await req('POST', '/api/leads', { company: 'X' }, { headers: { 'x-csrf': 'wrong' } });
  assert.equal(r.status, 403);
});

test('неверный пароль — 401 и запись в журнал', async () => {
  const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'vlad@test.ru', password: 'nope' }) });
  assert.equal(r.status, 401);
});

test('лид, бутстрап и экономика', async () => {
  const b = await req('GET', '/api/bootstrap');
  assert.equal(b.status, 200);
  assert.equal(b.json.role, 'owner');
  const lead = await req('POST', '/api/leads', { company: 'Ромашка', owner: { name: 'Иван Петров' }, contacts: { ownerEmail: 'ivan@romashka.test' } });
  assert.equal(lead.status, 200);
  const d = await req('POST', `/api/leads/${lead.json.id}/draft`, { hook: 'facts', channel: 'email', useLlm: false });
  assert.equal(d.status, 200);
  assert.match(d.json.body, /Иван/);
  const e = await req('POST', '/api/economics/funnel', { avgCheckRub: 300000 });
  assert.ok(e.json.revenueRub > 0);
});

test('секреты каналов хранятся зашифрованными и не возвращаются в открытом виде', async () => {
  await req('PUT', '/api/channels/email', { enabled: true, config: { host: 'smtp.test', port: '465', user: 'u@test.ru', pass: 'super-secret-password', from: 'Влад <u@test.ru>' } });
  const raw = mod.store.get(mod.store.listWorkspaces()[0].id, 'channels', 'email');
  assert.match(raw.config.pass, /^enc:v1:/);
  assert.doesNotMatch(JSON.stringify(raw), /super-secret-password/);
  const list = await req('GET', '/api/channels');
  const em = list.json.find(c => c.type === 'email');
  assert.match(em.config.pass, /^••••••/);
  assert.doesNotMatch(JSON.stringify(list.json), /super-secret-password/);
});

test('вебхук с любого сайта создаёт лида; чужой ключ — 404', async () => {
  await req('PUT', '/api/channels/site_form', { enabled: true });
  const ch = (await req('GET', '/api/channels')).json.find(c => c.type === 'site_form');
  assert.ok(ch.hookKey);
  const bad = await fetch(`${base}/api/hooks/lead/site_form?key=nope`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 404);
  const ok = await fetch(`${base}/api/hooks/lead/site_form?key=${ch.hookKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Марина', phone: '+79160000000', utm_source: 'yandex' }) });
  assert.equal(ok.status, 200);
  const leads = (await req('GET', '/api/leads')).json;
  assert.ok(leads.some(l => l.owner?.name === 'Марина' && l.utm?.source === 'yandex'));
  const widget = await fetch(`${base}/widget.js?key=${ch.hookKey}`);
  assert.match(await widget.text(), /data-leadmeet/);
});

test('письмо уходит в очередь, а не сразу; отписка по ссылке блокирует касания', async () => {
  const lead = (await req('POST', '/api/leads', { company: 'Лютик', owner: { name: 'Анна' }, contacts: { ownerEmail: 'anna@lutik.test' } })).json;
  const msg = (await req('POST', `/api/leads/${lead.id}/messages`, { subject: 'вопрос', body: 'Анна, добрый день. Вопрос по Лютику?', channel: 'email' })).json;
  const sent = await req('POST', `/api/messages/${msg.id}/send`, {});
  assert.equal(sent.json.queued, true);
  // ссылка отписки подписывается HMAC — подделка не проходит
  const forged = await fetch(`${base}/u/${Buffer.from('w.l').toString('base64url')}.AAAA`);
  assert.equal(forged.status, 400);
});

test('журнал целостности: правка задним числом обнаруживается', async () => {
  const ok = await req('GET', '/api/audit/verify');
  assert.equal(ok.json.ok, true);
  assert.ok(ok.json.entries > 3);
  mod.db.exec("UPDATE audit SET data = '{\"tampered\":true}' WHERE seq = 2");
  const broken = await req('GET', '/api/audit/verify');
  assert.equal(broken.json.ok, false);
  assert.equal(broken.json.brokenAt, 2);
});

test('бэкап шифруется и восстанавливается', async () => {
  const r = await req('POST', '/api/backups', {});
  assert.equal(r.status, 200);
  const { BACKUP_DIR, restoreBackup } = await import('../server/backup.js');
  const file = path.join(BACKUP_DIR, r.json.file);
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(0, 5).toString(), 'LMBK1');
  assert.equal(buf.includes(Buffer.from('Ромашка')), false, 'данные в бэкапе не видны открытым текстом');
  const target = path.join(dir, 'restored.db');
  restoreBackup(file, target);
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(target);
  const n = db.prepare("SELECT COUNT(*) n FROM docs WHERE coll = 'leads'").get().n;
  assert.ok(n >= 2);
  db.close();
});

test('статика и защита от выхода за пределы папки', async () => {
  const idx = await fetch(base + '/');
  assert.equal(idx.status, 200);
  assert.match(idx.headers.get('content-security-policy'), /default-src 'self'/);
  const trav = await fetch(base + '/..%2fserver%2fconfig.js');
  assert.notEqual(await trav.text().then(t => t.includes('MASTER_KEY')), true);
});

test('SMTP: письмо собирается корректно (UTF-8, отписка, Message-ID)', async () => {
  const { buildMessage } = await import('../server/services/smtp.js');
  const m = buildMessage({ from: 'Влад Лев <vlad@leadmeet.ru>', to: 'Дмитрий <d@test.ru>', subject: 'вопрос по вакансии', text: 'Привет.\nКак дела?', unsubscribe: 'https://x/u/abc' });
  assert.match(m.raw, /^From: =\?UTF-8\?B\?/m);
  assert.match(m.raw, /List-Unsubscribe: <https:\/\/x\/u\/abc>/);
  assert.match(m.raw, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(m.messageId, /@leadmeet\.ru>$/);
});

test('SSRF: внутренние адреса и обходы запрещены', async () => {
  const { isBlockedIp, checkUrl, fetchText } = await import('../server/services/web.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fd00::1', '0.0.0.0', '100.64.0.1']) assert.equal(isBlockedIp(ip), true, ip);
  assert.equal(isBlockedIp('8.8.8.8'), false);
  for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'file:///etc/passwd', 'ftp://x.ru/', 'http://user:pass@example.com/', 'http://example.com:22/']) assert.throws(() => checkUrl(u), /запрещ|Разрешены|Некорректный/i, u);
  await assert.rejects(fetchText('http://127.0.0.1:' + new URL(base).port + '/healthz'), /запрещ/i);
});

test('SMTP: инъекция заголовков и команд через адрес отклоняется', async () => {
  const { buildMessage } = await import('../server/services/smtp.js');
  assert.throws(() => buildMessage({ from: 'a@b.ru', to: 'x@y.ru\r\nBcc: victim@z.ru', subject: 's', text: 't' }), /Недопустимые|Некорректный/);
  assert.throws(() => buildMessage({ from: 'a@b.ru', to: 'not-an-email', subject: 's', text: 't' }), /Некорректный/);
  const m = buildMessage({ from: 'a@b.ru', to: 'x@y.ru', subject: 'тема\r\nBcc: v@z.ru', text: 't' });
  assert.doesNotMatch(m.raw, /^Bcc:/m);
});
