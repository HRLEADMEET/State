// LEADMEET OS — HTTP-сервер. Без фреймворков: node:http + node:sqlite.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, ROOT, MASTER_KEY } from './config.js';
import { openDb, SqliteStore } from './db.js';
import { hashPassword, verifyPassword, passwordProblems, token, sha256, seal, unseal, verifyTotp, newTotpSecret, RateLimiter } from './security.js';
import { backupNow, listBackups } from './backup.js';
import { hhService } from './services/hh.js';
import { webService } from './services/web.js';
import { llmService } from './services/llm.js';
import { sendMail } from './services/smtp.js';
import { telegramSend, transcribe, usdRate, OAUTH, oauthEnabled } from './services/misc.js';
import { handle, inboundLead, getSettings, sendQuota } from '../core/router.js';
import { seedDemo, mockServices } from '../core/seed.js';
import { HttpError, nowIso, uid } from '../core/util.js';
import { PLANS } from '../core/catalog.js';

const db = openDb();
const store = new SqliteStore(db);
const WEB = path.join(ROOT, 'web');
const loginLimiter = new RateLimiter(10, 15 * 60_000);
const apiLimiter = new RateLimiter(600, 60_000);
const hookLimiter = new RateLimiter(60, 60_000);

// ---------- channel config with unsealed secrets ----------
async function channelConfig(ctx, type) {
  const c = store.get(ctx.ws.id, 'channels', type);
  if (!c) return null;
  const out = {};
  for (const [k, v] of Object.entries(c.config || {})) { try { out[k] = unseal(v); } catch { out[k] = ''; } }
  return { ...out, enabled: c.enabled };
}

const hh = hhService(channelConfig);
const llm = llmService(channelConfig);

function unsubscribeToken(ws, leadId) {
  const payload = Buffer.from(`${ws}.${leadId}`).toString('base64url');
  const sig = crypto.createHmac('sha256', unsealKey()).update(payload).digest('base64url').slice(0, 22);
  return payload + '.' + sig;
}
const UNSUB_KEY = crypto.createHmac('sha256', MASTER_KEY).update('unsubscribe-links').digest();
const unsealKey = () => UNSUB_KEY;

function services(ctx) {
  // Демо-кабинет на сервере работает на вымышленных данных: hh.ru, сайты и почта имитируются.
  if (config.demoMode && ctx.ws?.demo) return { ...realServices(ctx), ...mockServices(), llm };
  return realServices(ctx);
}

function realServices(ctx) {
  return {
    hh, web: webService, llm,
    secrets: { seal: async (v) => seal(v) },
    mail: {
      async send(ctx, m) {
        const cfg = await channelConfig(ctx, 'email');
        if (!cfg?.enabled) throw new HttpError(400, 'Почта выключена в разделе «Каналы».');
        return sendMail(cfg, { from: cfg.from || cfg.user, to: m.to, subject: m.subject, text: m.text, unsubscribe: `${config.baseUrl}/u/${unsubscribeToken(ctx.ws.id, m.leadId)}` });
      },
    },
    async notify(ctx, text) {
      const c = await channelConfig(ctx, 'telegram_bot');
      const bot = c?.enabled && c.botToken ? c.botToken : config.telegramBotToken;
      const chat = c?.enabled && c.chatId ? c.chatId : config.telegramChatId;
      if (bot && chat) await telegramSend(bot, chat, text).catch(e => console.warn('[notify]', e.message));
    },
    async testChannel(ctx, type) {
      const c = await channelConfig(ctx, type) || {};
      try {
        if (type === 'telegram_bot') { await telegramSend(c.botToken, c.chatId, '✅ LEADMEET OS: уведомления подключены.'); return { ok: true, message: 'Сообщение отправлено в Telegram.' }; }
        if (type === 'email') { const me = (await getSettings(ctx)).me; const to = me.email || c.user; await sendMail(c, { from: c.from || c.user, to, subject: 'проверка почты LEADMEET OS', text: 'Если вы это читаете — SMTP настроен верно.' }); return { ok: true, message: 'Тестовое письмо отправлено на ' + to }; }
        if (type === 'hh') { const r = await hh.search(ctx, { text: 'коммерческий директор', per_page: 1 }); return { ok: true, message: `hh.ru отвечает: найдено ${r.found} вакансий.` }; }
        if (type === 'llm') { const ok = await llm.available(ctx); return { ok, message: ok ? 'Ключ Claude сохранён.' : 'Ключ не указан.' }; }
        return { ok: true, message: 'Сохранено. Для этого канала проверка — первым реальным событием.' };
      } catch (e) { return { ok: false, message: e.message }; }
    },
    auditVerify: async (ctx) => store.auditVerify(ctx.ws.id),
    auditList: async (ctx, n) => store.auditList(ctx.ws.id, n),
  };
}

function makeCtx(sess, user, role) {
  const ws = store.getWorkspace(sess.ws);
  const ctx = { store, ws, user, role, demo: config.demoMode, workspaces: store.workspacesOf(user.id).map(w => ({ id: w.id, name: w.name, kind: w.kind, role: w.role })) };
  ctx.services = services(ctx);
  ctx.audit = async (e) => store.audit(e);
  ctx.onWorkspaceCreated = async (w) => { store.addMember(w.id, user.id, 'owner'); };
  return ctx;
}

// ---------- http helpers ----------
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com https://oauth.yandex.ru https://id.vk.com",
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { ...SEC_HEADERS, ...(isBuf || typeof body === 'string' ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new HttpError(413, 'Слишком большой запрос')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const b = await readBody(req, limit);
  if (!b.length) return {};
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(b.toString('utf8')));
  try { return JSON.parse(b.toString('utf8')); } catch { throw new HttpError(400, 'Некорректный JSON'); }
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
}
function setCookie(name, value, { maxAge, httpOnly = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${config.secureCookies ? '; Secure' : ''}${maxAge !== undefined ? '; Max-Age=' + maxAge : ''}`;
}
const ip = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

function startSession(res, req, user, wsId) {
  const raw = token(32); const csrf = token(18);
  store.createSession({ id: sha256(raw), user: user.id, ws: wsId, csrf, expires: Date.now() + config.sessionDays * 86400_000, ip: ip(req), ua: String(req.headers['user-agent'] || '').slice(0, 200) });
  res.setHeader('Set-Cookie', [setCookie('lm_sid', raw, { maxAge: config.sessionDays * 86400 }), setCookie('lm_csrf', csrf, { maxAge: config.sessionDays * 86400, httpOnly: false })]);
  return csrf;
}
function currentSession(req) {
  const raw = cookies(req).lm_sid;
  if (!raw) return null;
  const s = store.session(sha256(raw));
  if (!s || s.expires < Date.now()) return null;
  const user = store.userById(s.user);
  if (!user || user.disabled) return null;
  let role = store.memberRole(s.ws, user.id);
  if (!role) { const first = store.workspacesOf(user.id)[0]; if (!first) return null; store.setSessionWs(s.id, first.id); s.ws = first.id; role = first.role; }
  return { sess: s, user, role };
}

// ---------- auth ----------
function createAccount({ email, password, name, wsName }) {
  const user = store.createUser({ email, name: name || '', pass: password ? hashPassword(password) : null });
  const isFirst = store.countUsers() === 1;
  const plan = isFirst ? 'agency' : 'start';
  const ws = store.createWorkspace({ name: wsName || (isFirst ? 'LEADMEET' : (name || email.split('@')[0]) + ' — кабинет'), kind: 'own', plan, credits: isFirst ? 5000 : (PLANS.find(p => p.id === 'start').credits / 3 | 0), ownerUserId: user.id });
  store.audit({ ws: ws.id, user: user.id, action: 'user.register', data: { email: user.email } });
  return { user, ws };
}

async function authRoute(req, res, sub) {
  const m = req.method;
  if (m === 'GET' && sub === 'state') {
    return send(res, 200, { hasUsers: store.countUsers() > 0, allowSignup: config.allowSignup || store.countUsers() === 0, demoMode: config.demoMode, oauth: oauthEnabled() });
  }
  if (m === 'POST' && (sub === 'login' || sub === 'register' || sub === 'demo')) {
    if (!loginLimiter.hit(ip(req))) throw new HttpError(429, 'Слишком много попыток. Подождите 15 минут.');
  }
  const body = m === 'POST' ? await readJson(req) : {};
  if (m === 'POST' && sub === 'register') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Укажите корректный email.');
    if (store.countUsers() > 0 && !config.allowSignup && !body.invite) throw new HttpError(403, 'Регистрация закрыта. Попросите приглашение у владельца.');
    if (store.userByEmail(email)) throw new HttpError(409, 'Такой email уже зарегистрирован.');
    const probs = passwordProblems(body.password || '');
    if (probs.length) throw new HttpError(400, 'Пароль: ' + probs.join(', ') + '.');
    if (body.invite) {
      const inv = store.invite(body.invite);
      if (!inv) throw new HttpError(400, 'Приглашение недействительно или истекло.');
      const user = store.createUser({ email, name: body.name || '', pass: hashPassword(body.password) });
      store.addMember(inv.ws, user.id, inv.role); store.deleteInvite(inv.token);
      store.audit({ ws: inv.ws, user: user.id, action: 'user.accept_invite', data: { role: inv.role } });
      const csrf = startSession(res, req, user, inv.ws);
      return send(res, 200, { ok: true, csrf });
    }
    const { user, ws } = createAccount({ email, password: body.password, name: body.name, wsName: body.company });
    const csrf = startSession(res, req, user, ws.id);
    return send(res, 200, { ok: true, csrf });
  }
  if (m === 'POST' && sub === 'login') {
    const user = store.userByEmail(String(body.email || '').trim());
    if (!user || !user.pass || !verifyPassword(body.password || '', user.pass)) { store.audit({ action: 'auth.fail', data: { email: String(body.email || '').slice(0, 80), ip: ip(req) } }); throw new HttpError(401, 'Неверный email или пароль.'); }
    if (user.totpEnabled) {
      if (!body.totp) return send(res, 200, { needTotp: true });
      if (!verifyTotp(unseal(user.totpSecret), body.totp)) throw new HttpError(401, 'Неверный код из приложения-аутентификатора.');
    }
    const ws = store.workspacesOf(user.id)[0];
    if (!ws) throw new HttpError(403, 'У пользователя нет кабинетов.');
    const csrf = startSession(res, req, user, ws.id);
    store.audit({ ws: ws.id, user: user.id, action: 'auth.login', data: { ip: ip(req) } });
    return send(res, 200, { ok: true, csrf });
  }
  if (m === 'POST' && sub === 'demo') {
    if (!config.demoMode) throw new HttpError(403, 'Демо-режим выключен.');
    const user = store.userByEmail('demo@leadmeet.local');
    const ws = user && store.workspacesOf(user.id)[0];
    if (!ws) throw new HttpError(500, 'Демо ещё не создано.');
    return send(res, 200, { ok: true, csrf: startSession(res, req, user, ws.id) });
  }
  // OAuth: старт и колбэк
  const om = sub.match(/^oauth\/(google|yandex|vk)(\/callback)?$/);
  if (m === 'GET' && om) return oauthRoute(req, res, om[1], !!om[2]);

  // всё ниже — для вошедших
  const cur = currentSession(req);
  if (!cur) throw new HttpError(401, 'Войдите в систему.');
  if (m === 'POST' && req.headers['x-csrf'] !== cur.sess.csrf) throw new HttpError(403, 'CSRF: обновите страницу.');
  const { user, sess } = cur;
  if (m === 'POST' && sub === 'logout') { store.deleteSession(sess.id); res.setHeader('Set-Cookie', [setCookie('lm_sid', '', { maxAge: 0 }), setCookie('lm_csrf', '', { maxAge: 0, httpOnly: false })]); return send(res, 200, { ok: true }); }
  if (m === 'POST' && sub === 'logout-all') { store.deleteUserSessions(user.id); store.audit({ ws: sess.ws, user: user.id, action: 'auth.logout_all' }); return send(res, 200, { ok: true }); }
  if (m === 'POST' && sub === 'switch') {
    if (!store.memberRole(body.wsId, user.id)) throw new HttpError(403, 'Нет доступа к кабинету.');
    store.setSessionWs(sess.id, body.wsId); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && sub === 'totp/setup') {
    const secret = newTotpSecret(); user.totpPending = seal(secret); store.saveUser(user);
    return send(res, 200, { secret, otpauth: `otpauth://totp/LEADMEET:${encodeURIComponent(user.email)}?secret=${secret}&issuer=LEADMEET` });
  }
  if (m === 'POST' && sub === 'totp/enable') {
    if (!user.totpPending || !verifyTotp(unseal(user.totpPending), body.code)) throw new HttpError(400, 'Код не подошёл.');
    user.totpSecret = user.totpPending; user.totpEnabled = true; delete user.totpPending; store.saveUser(user);
    store.audit({ ws: sess.ws, user: user.id, action: 'auth.totp_on' }); return send(res, 200, { ok: true });
  }
  if (m === 'POST' && sub === 'password') {
    if (user.pass && !verifyPassword(body.old || '', user.pass)) throw new HttpError(400, 'Текущий пароль неверен.');
    const probs = passwordProblems(body.password || ''); if (probs.length) throw new HttpError(400, 'Пароль: ' + probs.join(', ') + '.');
    user.pass = hashPassword(body.password); store.saveUser(user); store.deleteUserSessions(user.id);
    store.audit({ ws: sess.ws, user: user.id, action: 'auth.password' });
    return send(res, 200, { ok: true, relogin: true });
  }
  if (m === 'POST' && sub === 'invite') {
    if (cur.role !== 'owner') throw new HttpError(403, 'Приглашать может только владелец.');
    const role = ['manager', 'client', 'observer', 'owner'].includes(body.role) ? body.role : 'manager';
    const t = token(24); store.createInvite({ token: t, ws: sess.ws, role, email: body.email, expires: Date.now() + 7 * 86400_000 });
    store.audit({ ws: sess.ws, user: user.id, action: 'member.invite', data: { role, email: body.email } });
    return send(res, 200, { link: `${config.baseUrl}/#invite=${t}`, role });
  }
  if (m === 'GET' && sub === 'members') return send(res, 200, store.membersOf(sess.ws));
  throw new HttpError(404, 'Нет такого метода');
}

const oauthStates = new Map();
async function oauthRoute(req, res, provider, isCallback) {
  const cfg = config.oauth[provider]; const p = OAUTH[provider];
  if (!cfg?.id || !cfg?.secret) throw new HttpError(400, `Вход через ${provider} не настроен: добавьте ${provider.toUpperCase()}_CLIENT_ID и ${provider.toUpperCase()}_CLIENT_SECRET в .env.`);
  const redirect = `${config.baseUrl}/api/auth/oauth/${provider}/callback`;
  const url = new URL(req.url, config.baseUrl);
  if (!isCallback) {
    const state = token(16); const verifier = token(32);
    oauthStates.set(state, { verifier, at: Date.now() });
    const q = new URLSearchParams({ client_id: cfg.id, redirect_uri: redirect, response_type: 'code', scope: p.scope, state });
    if (p.pkce) { q.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url')); q.set('code_challenge_method', 'S256'); }
    res.writeHead(302, { Location: p.auth + '?' + q }); return res.end();
  }
  const st = oauthStates.get(url.searchParams.get('state'));
  oauthStates.delete(url.searchParams.get('state'));
  if (!st || Date.now() - st.at > 10 * 60_000) throw new HttpError(400, 'Сессия входа устарела, попробуйте снова.');
  const form = new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', client_id: cfg.id, client_secret: cfg.secret, redirect_uri: redirect });
  if (p.pkce) { form.set('code_verifier', st.verifier); if (url.searchParams.get('device_id')) form.set('device_id', url.searchParams.get('device_id')); }
  const tr = await fetch(p.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const tj = await tr.json();
  if (!tj.access_token) throw new HttpError(400, 'Провайдер не выдал токен.');
  const prof = await p.profile(tj, cfg);
  if (!prof.email || !prof.verified) throw new HttpError(400, 'Провайдер не подтвердил email.');
  let user = store.userByEmail(prof.email);
  if (!user) {
    if (store.countUsers() > 0 && !config.allowSignup) throw new HttpError(403, 'Регистрация закрыта.');
    user = createAccount({ email: prof.email, name: prof.name }).user;
  }
  const ws = store.workspacesOf(user.id)[0];
  startSession(res, req, user, ws.id);
  store.audit({ ws: ws.id, user: user.id, action: 'auth.oauth', data: { provider } });
  res.writeHead(302, { Location: '/' }); res.end();
}

// ---------- webhooks (public, by key) ----------
async function hookRoute(req, res, rest, url) {
  if (!hookLimiter.hit(ip(req))) throw new HttpError(429, 'Слишком часто');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method === 'OPTIONS') return send(res, 204, '', cors);
  const key = url.searchParams.get('key') || '';
  const found = key && store.findChannelByHookKey(key);
  if (!found) return send(res, 404, { error: 'Неизвестный ключ' }, cors);
  const ws = store.getWorkspace(found.ws);
  const ctx = { store, ws, user: null, role: 'owner', demo: false };
  ctx.services = services(ctx); ctx.audit = async (e) => store.audit(e);
  const body = await readJson(req, 200_000);
  if (rest.startsWith('lead/')) {
    if (found.channel.type === 'vk' && body.type === 'confirmation') return send(res, 200, unseal(found.channel.config?.confirm || ''), { 'Content-Type': 'text/plain' });
    const lead = await inboundLead(ctx, found.channel.type, body.object || body);
    if (found.channel.type === 'vk') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
    return send(res, 200, { ok: true, id: lead.id }, cors);
  }
  if (rest === 'transcript') {
    const text = body.transcript || body.text || (Array.isArray(body.utterances) ? body.utterances.map(u => `${u.speaker}: ${u.text}`).join('\n') : '');
    const call = await handle(ctx, 'POST', '/calls', { transcript: text, leadId: body.leadId, title: body.title || 'Запись из ' + found.channel.type, source: 'webhook' });
    return send(res, 200, { ok: true, id: call.id });
  }
  throw new HttpError(404, 'Нет такого вебхука');
}

function widgetJs(key) {
  return `(function(){var k=${JSON.stringify(key)},u=${JSON.stringify(config.baseUrl)};
document.querySelectorAll('form[data-leadmeet]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();
var d={};new FormData(f).forEach(function(v,n){d[n]=v});var p=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(x){if(p.get(x))d[x]=p.get(x)});d.page=location.href;
fetch(u+'/api/hooks/lead/site_form?key='+encodeURIComponent(k),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(){f.innerHTML='<p>Спасибо! Свяжусь с вами в течение рабочего дня.</p>'})})})})();`;
}

// ---------- unsubscribe ----------
function unsubscribe(req, res, t) {
  const [payload, sig] = String(t).split('.');
  const good = payload && sig && crypto.createHmac('sha256', unsealKey()).update(payload).digest('base64url').slice(0, 22) === sig;
  if (!good) return send(res, 400, 'Ссылка недействительна', { 'Content-Type': 'text/plain; charset=utf-8' });
  const [ws, leadId] = Buffer.from(payload, 'base64url').toString().split('.');
  const lead = store.get(ws, 'leads', leadId);
  if (lead) { lead.optOut = true; lead.optOutAt = nowIso(); store.put(ws, 'leads', lead); store.audit({ ws, action: 'lead.unsubscribe', data: { id: leadId } }); }
  return send(res, 200, '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:40px;max-width:520px;margin:auto"><h2>Готово</h2><p>Больше не напишу. Если это ошибка — просто ответьте на любое моё письмо.</p></body>', { 'Content-Type': 'text/html; charset=utf-8' });
}

// ---------- static ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.startsWith('/core/')) { const f = path.normalize(path.join(ROOT, rel)); if (f.startsWith(path.join(ROOT, 'core') + path.sep) && fs.existsSync(f)) return send(res, 200, fs.readFileSync(f), { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-cache' }); }
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(WEB, rel));
  if (!file.startsWith(WEB + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
  return send(res, 200, fs.readFileSync(file), { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
}

// ---------- main handler ----------
async function route(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (p === '/healthz') return send(res, 200, { ok: true, at: nowIso() });
  if (p.startsWith('/u/')) return unsubscribe(req, res, p.slice(3));
  if (p === '/widget.js') return send(res, 200, widgetJs(url.searchParams.get('key') || ''), { 'Content-Type': MIME['.js'], 'Access-Control-Allow-Origin': '*' });
  if (p.startsWith('/api/hooks/')) return hookRoute(req, res, p.slice('/api/hooks/'.length), url);
  if (p.startsWith('/api/auth/')) return authRoute(req, res, p.slice('/api/auth/'.length));
  if (!p.startsWith('/api/')) return serveStatic(req, res, p);

  if (!apiLimiter.hit(ip(req))) throw new HttpError(429, 'Слишком много запросов');
  const cur = currentSession(req);
  if (!cur) throw new HttpError(401, 'Войдите в систему.');
  if (req.method !== 'GET' && req.headers['x-csrf'] !== cur.sess.csrf) throw new HttpError(403, 'CSRF: обновите страницу.');
  const ctx = makeCtx(cur.sess, cur.user, cur.role);
  const sub = p.slice(4);

  // серверные маршруты
  if (sub === '/calls/audio' && req.method === 'POST') {
    const buf = await readBody(req, 30_000_000);
    const cfg = await channelConfig(ctx, 'recorder');
    const text = await transcribe({ provider: cfg?.provider, key: cfg?.key }, buf, req.headers['content-type'] || 'audio/mpeg', url.searchParams.get('filename') || 'call.mp3');
    const call = await handle(ctx, 'POST', '/calls', { transcript: text, leadId: url.searchParams.get('leadId') || null, meetingId: url.searchParams.get('meetingId') || null, title: url.searchParams.get('filename') || 'Аудио', source: 'audio' });
    return send(res, 200, call);
  }
  if (sub === '/export' && req.method === 'GET') {
    if (cur.role !== 'owner') throw new HttpError(403, 'Только владелец.');
    const out = { exportedAt: nowIso(), workspace: ctx.ws, data: {} };
    for (const c of ['settings', 'leads', 'messages', 'experiments', 'meetings', 'calls', 'deals']) out.data[c] = store.list(ctx.ws.id, c);
    store.audit({ ws: ctx.ws.id, user: cur.user.id, action: 'data.export' });
    return send(res, 200, JSON.stringify(out, null, 1), { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="leadmeet-export-${new Date().toISOString().slice(0, 10)}.json"` });
  }
  if (sub === '/backups' && req.method === 'GET') { if (cur.role !== 'owner') throw new HttpError(403, 'Только владелец.'); return send(res, 200, { backups: listBackups(), everyHours: config.backupEveryHours, keep: config.backupKeep }); }
  if (sub === '/backups' && req.method === 'POST') { if (cur.role !== 'owner') throw new HttpError(403, 'Только владелец.'); const b = backupNow(db); store.audit({ ws: ctx.ws.id, user: cur.user.id, action: 'backup.manual', data: { sha256: b.sha256 } }); return send(res, 200, { ...b, file: path.basename(b.file) }); }
  if (sub === '/fx' && req.method === 'GET') return send(res, 200, { usdRate: await usdRate() });
  if (sub === '/bootstrap') {
    const data = await handle(ctx, 'GET', '/bootstrap');
    data.csrf = cur.sess.csrf; data.oauth = oauthEnabled(); data.baseUrl = config.baseUrl;
    return send(res, 200, data);
  }

  const body = req.method === 'GET' ? {} : await readJson(req);
  const data = await handle(ctx, req.method, sub, body, Object.fromEntries(url.searchParams));
  return send(res, 200, data);
}

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error('[error]', req.method, req.url, e);
    if (!res.headersSent) send(res, status, { error: status >= 500 ? 'Внутренняя ошибка сервера. Подробности в логе.' : e.message });
    else res.end();
  });
});
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;

// ---------- background: email queue with warmup & human pacing ----------
async function emailTick() {
  const now = new Date();
  for (const ws of store.listWorkspaces()) {
    const queued = store.list(ws.id, 'messages').filter(m => m.status === 'queued' && m.channel === 'email');
    if (!queued.length) continue;
    const owner = store.membersOf(ws.id).find(m => m.role === 'owner');
    const user = owner && store.userById(owner.id);
    if (!user) continue;
    const ctx = { store, ws, user, role: 'owner' }; ctx.services = services(ctx); ctx.audit = async (e) => store.audit(e);
    const settings = await getSettings(ctx);
    const s = settings.sending;
    const h = now.getHours();
    if (h < s.windowFrom || h >= s.windowTo || (s.weekdaysOnly && (now.getDay() === 0 || now.getDay() === 6))) continue;
    const q = await sendQuota(ctx, settings);
    if (q.left <= 0) continue;
    const key = 'lastEmail:' + ws.id; const last = store.kvGet(key) || { at: 0, gap: 0 };
    if (Date.now() - last.at < last.gap * 1000) continue;
    const msg = queued.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
    try {
      await handle(ctx, 'POST', `/messages/${msg.id}/send`, { now: true });
      const gap = s.minGapSec + Math.floor(Math.random() * Math.max(1, s.maxGapSec - s.minGapSec));
      store.kvSet(key, { at: Date.now(), gap });
    } catch (e) {
      msg.status = 'error'; msg.error = e.message; store.put(ws.id, 'messages', msg);
      console.warn('[email]', ws.id, e.message);
    }
  }
}

// ---------- startup ----------
async function ensureDemo() {
  if (!config.demoMode || store.userByEmail('demo@leadmeet.local')) return;
  const user = store.createUser({ email: 'demo@leadmeet.local', name: 'Влад (демо)', pass: hashPassword(token(16)) });
  const ws = store.createWorkspace({ name: 'LEADMEET · демо', kind: 'own', plan: 'agency', credits: 5000, ownerUserId: user.id, demo: true });
  const ctx = { store, ws, user, role: 'owner', services: mockServices(), audit: async (e) => store.audit(e) };
  await seedDemo(ctx);
  console.log('[demo] Демо-кабинет создан с тестовой воронкой.');
}

export async function start(port = config.port) {
  await ensureDemo();
  store.purgeSessions();
  setInterval(() => emailTick().catch(e => console.warn('[email tick]', e.message)), 60_000).unref();
  setInterval(() => { try { const b = backupNow(db); console.log('[backup]', path.basename(b.file)); } catch (e) { console.error('[backup]', e.message); } }, config.backupEveryHours * 3600_000).unref();
  setInterval(() => store.purgeSessions(), 3600_000).unref();
  try { if (!listBackups().length && store.countUsers() > 0) backupNow(db); } catch (e) { console.warn('[backup]', e.message); }
  await new Promise(r => server.listen(port, config.host, r));
  console.log(`LEADMEET OS → ${config.baseUrl}  (порт ${port}${config.demoMode ? ', демо-режим' : ''})`);
  return server;
}

export { server, store, db, uid };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'server/index.js')) start();
