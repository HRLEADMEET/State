// API-логика, общая для сервера (SQLite) и демо-версии (хранилище браузера).
// ctx = { store, ws, user, role, services, audit }
import { uid, nowIso, HttpError, need, sum, groupBy, pct, round, deepMerge, fmtMoney, sanitizeObject, safeUrl, isEmail, safeDecode, clip } from './util.js';
import { DEFAULT_OFFERS, PLANS, CREDIT_PACKS, CREDIT_COST, CHANNELS, STAGES, NICHES, PROOFS, BRAND, ROLES, can } from './catalog.js';
import { vacancyToLead, buildHhQueries } from './hhSignals.js';
import { draftMessage, followUp, HOOKS, REPLY_PLAYBOOK } from './generator.js';
import { checkMessage, classifyReply } from './quality.js';
import { analyzeStyle } from './stylometry.js';
import { evaluate, nextVariant } from './abtest.js';
import { buildCallScript } from './callscript.js';
import { analyzeCall, learnFromCalls } from './callAnalysis.js';
import { parseSite, parseTelegramChannel } from './research.js';
import { funnelModel, payback, saasModel, channelRoi, PAYMENT_TERMS, paymentPlan } from './economics.js';
import { parsePeople } from './research.js';
import { DEFAULT_FILTERS } from './hhSignals.js';
import { registerPipeline } from './pipeline.js';
import { registerGrowth } from './growth.js';
import { preSendGate } from './harvey.js';
import { leadSummary } from './summary.js';

const routes = [];
const R = (method, path, perm, fn) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, perm, fn });
};

export async function handle(ctx, method, path, body = {}, query = {}) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    if (r.perm && !can(ctx.role, r.perm)) throw new HttpError(403, 'Недостаточно прав для этого действия.');
    const params = {};
    for (let i = 0; i < r.keys.length; i++) { const v = safeDecode(m[i + 1]); if (v === null) throw new HttpError(400, 'Некорректный адрес.'); params[r.keys[i]] = v; }
    return await r.fn(ctx, { params, body: sanitizeObject(body || {}), query: query || {} });
  }
  throw new HttpError(404, 'Нет такого метода API: ' + method + ' ' + path);
}

// ---------- helpers ----------
const S = (ctx) => ctx.store;
async function list(ctx, coll) { return (await S(ctx).list(ctx.ws.id, coll)) || []; }
async function get(ctx, coll, id) { const d = await S(ctx).get(ctx.ws.id, coll, id); if (!d) throw new HttpError(404, 'Не найдено'); return d; }
async function put(ctx, coll, doc) { doc.updatedAt = nowIso(); doc.createdAt ||= doc.updatedAt; await S(ctx).put(ctx.ws.id, coll, doc); return doc; }
async function audit(ctx, action, data) { if (ctx.audit) await ctx.audit({ ws: ctx.ws.id, user: ctx.user?.id, action, data }); }

export async function getSettings(ctx) {
  const s = await S(ctx).get(ctx.ws.id, 'settings', 'main');
  return deepMerge(defaultSettings(ctx.ws), s || {});
}
export function defaultSettings(ws = {}) {
  return {
    id: 'main',
    me: { name: BRAND.person, title: BRAND.title, telegram: BRAND.telegram, email: '', signature: '', mySample: '' },
    brand: { name: ws.name || BRAND.name, auditPage: '', calculatorPage: '', channel: BRAND.channel },
    usdRate: 92,
    offers: DEFAULT_OFFERS,
    sending: { dailyCap: 30, warmupStart: 5, warmupStep: 3, windowFrom: 9, windowTo: 18, weekdaysOnly: true, minGapSec: 120, maxGapSec: 420 },
    hh: { roles: ['коммерческий директор', 'руководитель отдела продаж', 'директор по продажам', 'исполнительный директор', 'бизнес-ассистент собственника'], area: '', salaryFrom: 120000, period: 30, minScore: 45, resumeId: '', ...DEFAULT_FILTERS },
    llm: { enabled: true, model: 'claude-opus-5-5' },
    tz: { mine: 'Asia/Ho_Chi_Minh', clients: 'Europe/Moscow' },
    caps: { telegram: 25, whatsapp: 20, zalo: 20, hh_apply: 60, hh_chat: 80 },
    autopilot: { enabled: false, morningHour: 8, eveningHour: 20, dailyNew: 20, prepare: 20, minScore: 45, autoResearch: true, noReplyDays: 3 },
    proofs: null,
    playbook: { hhLetter: '', notes: '' },
    currency: { second: 'USD', markets: ['RUB', 'USD', 'KZT', 'VND', 'CNY', 'AED', 'EUR', 'TRY'] },
    fx: { rates: {} },
    harvey: { signals: ['HIRING_SALES', 'NO_TEAM_PAGE_OWNER', 'CHAT_NO_CRM', 'MULTI_BRANCH'], autopilot: false },
    referral: { percent: 10 },
    dismissed: [],
    onboardingDone: false, launchDone: false,
  };
}

async function spend(ctx, action, qty = 1) {
  const cost = (CREDIT_COST[action] || 0) * qty;
  if (!cost) return 0;
  const ws = await S(ctx).getWorkspace(ctx.ws.id);
  if ((ws.credits ?? 0) < cost) throw new HttpError(402, `Недостаточно кредитов: нужно ${cost}, осталось ${ws.credits ?? 0}. Пополните в разделе «Тариф».`);
  ws.credits -= cost;
  await S(ctx).saveWorkspace(ws);
  ctx.ws.credits = ws.credits;
  return cost;
}

function stageIndex(id) { return STAGES.findIndex(s => s.id === id); }
function advance(lead, stage) {
  if (lead.stage === 'lost' || lead.stage === 'won') return lead;
  if (stage === 'lost' || stageIndex(stage) > stageIndex(lead.stage)) { lead.stage = stage; (lead.history ||= []).push({ at: nowIso(), stage }); }
  return lead;
}

// ---------- bootstrap / settings ----------
R('GET', '/bootstrap', null, async (ctx) => {
  const settings = await getSettings(ctx);
  const ws = await S(ctx).getWorkspace(ctx.ws.id);
  return {
    user: ctx.user && { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name, totp: !!ctx.user.totpEnabled },
    role: ctx.role, roleName: ROLES[ctx.role]?.name,
    settings: ctx.role === 'owner' ? settings : publicSettings(settings),
    ws: { id: ws.id, name: ws.name, kind: ws.kind, plan: ws.plan, credits: ws.credits, parentId: ws.parentId || null },
    workspaces: ctx.workspaces || [ws],
    llm: !!(ctx.services?.llm?.available && await ctx.services.llm.available(ctx)),
    demo: !!ctx.demo,
    catalog: { plans: PLANS, creditPacks: CREDIT_PACKS, creditCost: CREDIT_COST, channels: CHANNELS, stages: STAGES, niches: NICHES, proofs: PROOFS, hooks: HOOKS, paymentTerms: PAYMENT_TERMS, brand: BRAND, roles: ROLES },
  };
});

R('GET', '/settings', 'settings', async (ctx) => getSettings(ctx));

/** Настройки для менеджера, клиента и наблюдателя: без email, личных образцов текста, скриптов и лимитов владельца. */
export function publicSettings(s) {
  return {
    id: 'main', me: { name: s.me?.name, title: s.me?.title, telegram: s.me?.telegram }, brand: { name: s.brand?.name }, usdRate: s.usdRate,
    offers: s.offers, hh: { roles: s.hh?.roles, area: s.hh?.area, salaryFrom: s.hh?.salaryFrom, period: s.hh?.period, minScore: s.hh?.minScore },
    currency: s.currency, fx: s.fx, tz: s.tz, autopilot: { enabled: !!s.autopilot?.enabled, morningHour: s.autopilot?.morningHour, eveningHour: s.autopilot?.eveningHour },
    onboardingDone: s.onboardingDone, launchDone: s.launchDone,
  };
}
R('PUT', '/settings', 'settings', async (ctx, { body }) => {
  const cur = await getSettings(ctx);
  const next = deepMerge(cur, body);
  next.id = 'main';
  if (body.offers) next.offers = body.offers;
  if (body.me && typeof body.me.mySample === 'string') next.me.myStyle = analyzeStyle(body.me.mySample);
  await put(ctx, 'settings', next);
  await audit(ctx, 'settings.update', Object.keys(body));
  return next;
});

// ---------- leads ----------
const leadsCache = new Map(); // ws → { v, list } — отсортированные сводки, пересчёт только после записи

async function sortedSummaries(ctx) {
  const v = S(ctx).version ? S(ctx).version(ctx.ws.id) : null;
  const hit = leadsCache.get(ctx.ws.id);
  if (v !== null && hit && hit.v === v) return hit.list;
  const list0 = S(ctx).summaries ? await S(ctx).summaries(ctx.ws.id, 'leads') : (await list(ctx, 'leads')).map(leadSummary);
  list0.sort((a, b) => (b.score || 0) - (a.score || 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  if (v !== null) { leadsCache.set(ctx.ws.id, { v, list: list0 }); if (leadsCache.size > 5000) leadsCache.delete(leadsCache.keys().next().value); }
  return list0;
}

/** Список лидов — лёгкая сводка (без фактов, истории и постов), фильтры и страница на сервере. */
R('GET', '/leads', 'leads:read', async (ctx, { query }) => {
  let leads = await sortedSummaries(ctx);
  if (query.stage) leads = leads.filter(l => l.stage === query.stage);
  if (query.q) { const q = String(query.q).toLowerCase().slice(0, 100); leads = leads.filter(l => [l.company, l.owner?.name, l.vacancy?.title, l.city].join(' ').toLowerCase().includes(q)); }
  const limit = Math.min(2000, Math.max(1, Number(query.limit) || 300));
  const offset = Math.max(0, Number(query.offset) || 0);
  return structuredClone(leads.slice(offset, offset + limit));
});

/** Количество лидов по этапам — для полосы этапов, без выгрузки списка. */
R('GET', '/leads/stats', 'leads:read', async (ctx) => {
  const by = S(ctx).countBy ? await S(ctx).countBy(ctx.ws.id, 'leads') : (await list(ctx, 'leads')).reduce((o, l) => { o[l.stage] = (o[l.stage] || 0) + 1; return o; }, {});
  return { byStage: by, total: Object.values(by).reduce((a, n) => a + n, 0) };
});

R('POST', '/leads', 'leads', async (ctx, { body }) => {
  need(body.company || body.owner?.name, 400, 'Укажите компанию или имя собственника.');
  const lead = {
    id: uid('l_'), stage: 'new', source: body.source || 'manual', score: body.score ?? 50,
    company: clip(body.company || '', 300), site: safeUrl(body.site), city: clip(body.city || '', 120), industry: clip(body.industry || '', 60),
    owner: { name: body.owner?.name || '', role: body.owner?.role || 'Собственник', social: body.owner?.social || {} },
    contacts: body.contacts || {}, facts: body.facts || [], hypotheses: body.hypotheses || [{ pain: 'Рост упёрся в систему продаж и найма.', offerId: 'setup' }],
    notes: body.notes || '', tags: body.tags || [], utm: body.utm || null,
  };
  await put(ctx, 'leads', lead);
  await audit(ctx, 'lead.create', { id: lead.id, source: lead.source });
  return lead;
});

R('GET', '/leads/:id', 'leads:read', async (ctx, { params }) => {
  const lead = await get(ctx, 'leads', params.id);
  const all = await list(ctx, 'messages');
  const messages = all.filter(m => m.leadId === lead.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const meetings = (await list(ctx, 'meetings')).filter(m => m.leadId === lead.id);
  const calls = (await list(ctx, 'calls')).filter(c => c.leadId === lead.id);
  const deals = (await list(ctx, 'deals')).filter(d => d.leadId === lead.id);
  return { lead, messages, meetings, calls, deals };
});

R('PUT', '/leads/:id', 'leads', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  const allowed = ['company', 'site', 'city', 'industry', 'owner', 'contacts', 'facts', 'hypotheses', 'notes', 'tags', 'stage', 'optOut', 'score'];
  for (const k of allowed) if (k in body) lead[k] = k === 'owner' ? deepMerge(lead.owner, body.owner) : body[k];
  if ('site' in body) lead.site = safeUrl(body.site);
  if (body.contacts) { lead.contacts.emails = (lead.contacts.emails || []).filter(isEmail); if (lead.contacts.ownerEmail && !isEmail(lead.contacts.ownerEmail)) throw new HttpError(400, 'Некорректный email собственника.'); }
  if (body.stage) (lead.history ||= []).push({ at: nowIso(), stage: body.stage, manual: true });
  await put(ctx, 'leads', lead);
  return lead;
});

R('DELETE', '/leads/:id', 'leads', async (ctx, { params }) => {
  await S(ctx).del(ctx.ws.id, 'leads', params.id);
  await audit(ctx, 'lead.delete', { id: params.id });
  return { ok: true };
});

// Исследование: сайт + публичный Telegram-канал собственника → факты и стиль.
R('POST', '/leads/:id/research', 'leads', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  const site = body.site || lead.site;
  const tg = (body.telegram || lead.owner?.social?.telegram || '').replace(/^@|https?:\/\/t\.me\/(s\/)?/g, '').trim();
  const log = [];
  await spend(ctx, 'research');
  if (site && ctx.services?.web) {
    try {
      const html = await ctx.services.web.fetch(site);
      const p = parseSite(html, site);
      lead.site = site;
      lead.siteInfo = { title: p.title, description: p.description, h1: p.h1, h2: p.h2, social: p.social };
      lead.contacts = { ...lead.contacts, emails: [...new Set([...(lead.contacts.emails || []), ...p.emails])], phones: [...new Set([...(lead.contacts.phones || []), ...p.phones])] };
      if (!tg && p.social.telegram) lead.owner.social.telegram = p.social.telegram[0];
      for (const [k, v] of Object.entries(p.social)) lead.owner.social[k] ||= v[0];
      mergeFacts(lead, p.facts);
      log.push(`Сайт: ${p.facts.length} фактов, ${p.emails.length} email, ${p.phones.length} тел.`);
    } catch (e) { log.push('Сайт не открылся: ' + e.message); }
  }
  if (lead.site && ctx.services?.web?.teamPages) {
    try {
      const pages = await ctx.services.web.teamPages(lead.site, 3);
      const people = pages.flatMap(p => parsePeople(p.html).map(x => ({ ...x, source: p.url })));
      if (people.length) {
        lead.people = people.slice(0, 6);
        const top = people[0];
        if (!lead.owner.name) { lead.owner.name = top.name; lead.owner.role = top.role; }
        mergeFacts(lead, people.slice(0, 2).map(x => ({ kind: 'site_team', text: `на сайте указан: ${x.name} — ${x.role}`, source: x.source })));
        log.push(`Команда: найдено ${people.length} чел., ЛПР — ${top.name} (${top.role})`);
      }
    } catch (e) { log.push('Страницы команды: ' + e.message); }
  }
  if (ctx.services?.dadata?.findCompany && lead.company) {
    try {
      const c = await ctx.services.dadata.findCompany(ctx, { query: lead.company, city: lead.city });
      if (c) {
        lead.egrul = c;
        if (c.director && !lead.owner.name) { lead.owner.name = c.director; lead.owner.role = c.directorPost || 'Генеральный директор'; }
        mergeFacts(lead, [
          c.director ? { kind: 'egrul', text: `по ЕГРЮЛ руководитель — ${c.director}${c.directorPost ? ' (' + c.directorPost.toLowerCase() + ')' : ''}`, source: 'ЕГРЮЛ' } : null,
          c.registered ? { kind: 'egrul', text: `компания зарегистрирована в ${c.registered.slice(0, 4)} году`, source: 'ЕГРЮЛ' } : null,
          c.employees ? { kind: 'egrul', text: `сотрудников по данным ФНС: ${c.employees}`, source: 'ЕГРЮЛ' } : null,
        ].filter(Boolean));
        log.push('ЕГРЮЛ: ' + (c.director || 'руководитель не указан'));
      }
    } catch (e) { log.push('ЕГРЮЛ: ' + e.message); }
  }
  if (tg && ctx.services?.web?.telegram) {
    try {
      const html = await ctx.services.web.telegram(tg);
      const ch = parseTelegramChannel(html);
      if (ch.posts.length) {
        lead.owner.posts = ch.posts.slice(-8);
        lead.owner.lastPost = ch.posts[ch.posts.length - 1];
        lead.owner.style = analyzeStyle(ch.posts.join('\n\n'));
        lead.owner.social.telegram = '@' + tg;
        mergeFacts(lead, [{ kind: 'post', text: `в канале «${ch.title || tg}» недавно писали: «${ch.posts[ch.posts.length - 1].slice(0, 100)}…»`, source: 'https://t.me/s/' + tg }]);
        log.push(`Telegram: ${ch.posts.length} постов, стиль: ${lead.owner.style.summary || '—'}`);
      } else log.push('Telegram: публичных постов не найдено.');
    } catch (e) { log.push('Telegram не открылся: ' + e.message); }
  }
  advance(lead, 'researched');
  lead.researchedAt = nowIso();
  await put(ctx, 'leads', lead);
  return { lead, log };
});

function mergeFacts(lead, facts) {
  lead.facts ||= [];
  for (const f of facts) if (!lead.facts.some(x => x.text === f.text)) lead.facts.push(f);
}

R('POST', '/leads/:id/style', 'leads', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  const st = analyzeStyle(body.text || '');
  if (!st.ok) throw new HttpError(400, st.reason);
  lead.owner.style = st;
  lead.owner.posts = String(body.text).split(/\n\s*\n/).slice(0, 8);
  lead.owner.lastPost = lead.owner.posts[0];
  await put(ctx, 'leads', lead);
  return { style: st };
});

// ---------- drafts & messages ----------
R('POST', '/leads/:id/draft', 'messages', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  const settings = await getSettings(ctx);
  let hook = body.hook || 'vacancy', experimentId = null, variantId = null, offer;
  if (body.experimentId) {
    const exp = await get(ctx, 'experiments', body.experimentId);
    const stats = await experimentStats(ctx, exp);
    variantId = body.variantId || nextVariant(stats.rows);
    const v = exp.variants.find(x => x.id === variantId);
    hook = v.hook; experimentId = exp.id;
    offer = settings.offers.find(o => o.id === v.offerId);
  }
  const channel = body.channel || 'email';
  const proofs = Array.isArray(settings.proofs) ? settings.proofs : (ctx.ws.kind === 'client' ? [] : PROOFS);
  let d = body.followUp ? followUp({ lead, step: body.followUp, channel, me: settings.me, proofs }) : draftMessage({ lead, me: settings.me, hook, channel, offer, proofs });
  let usedLlm = false;
  const llmOn = body.useLlm !== false && settings.llm?.enabled && ctx.services?.llm && await ctx.services.llm.available(ctx);
  if (llmOn && !body.followUp) {
    await spend(ctx, 'llm_message');
    try {
      const r = await ctx.services.llm.rewrite(ctx, { draft: d, lead, me: settings.me, hook, channel, proofs: proofs.length ? proofs : [{ text: 'кейсов пока нет — не упоминай цифры результатов' }] });
      if (r && r.body) { d = { ...d, subject: r.subject ?? d.subject, body: r.body }; usedLlm = true; }
    } catch (e) { d.llmError = e.message; }
  } else await spend(ctx, 'message');
  const quality = checkMessage({ subject: d.subject, body: d.body, channel, lead, sources: sourcesText(settings, proofs) });
  return { ...d, experimentId, variantId, usedLlm, quality };
});

R('POST', '/messages/check', 'messages', async (ctx, { body }) => {
  const lead = body.leadId ? await get(ctx, 'leads', body.leadId) : {};
  const settings = await getSettings(ctx);
  return checkMessage({ ...body, lead, sources: sourcesText(settings, Array.isArray(settings.proofs) ? settings.proofs : PROOFS) });
});

/** Всё, на что письмо может ссылаться цифрами: кейсы, офферы, подпись. */
export function sourcesText(settings, proofs) {
  return JSON.stringify([proofs, settings.offers, settings.me?.signature, settings.me?.title]);
}

R('GET', '/messages', 'messages:read', async (ctx, { query }) => {
  let msgs = await list(ctx, 'messages');
  if (query.status) msgs = msgs.filter(m => m.status === query.status);
  return msgs.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
});

R('POST', '/leads/:id/messages', 'messages', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  need(body.body, 400, 'Пустое сообщение.');
  need(String(body.body).length <= 20000, 400, 'Слишком длинное сообщение.');
  if ((body.channel || 'email') === 'email' && body.to && !isEmail(body.to)) throw new HttpError(400, 'Некорректный email получателя.');
  if (lead.optOut) throw new HttpError(409, 'Контакт попросил больше не писать — отправка заблокирована.');
  const msg = {
    id: uid('m_'), leadId: lead.id, direction: 'out', channel: body.channel || 'email',
    to: body.to || pickRecipient(lead, body.channel || 'email'),
    subject: body.subject || '', body: body.body, hook: body.hook || null,
    experimentId: body.experimentId || null, variantId: body.variantId || null,
    followUp: body.followUp || 0, status: body.status || 'draft',
  };
  await put(ctx, 'messages', msg);
  return msg;
});

function pickRecipient(lead, channel) {
  if (channel === 'email') return lead.contacts?.ownerEmail || lead.contacts?.emails?.[0] || '';
  if (channel === 'telegram') return lead.owner?.social?.telegram || '';
  if (channel === 'whatsapp' || channel === 'zalo') return lead.contacts?.phones?.[0] || '';
  if (channel === 'hh_chat') return lead.vacancy?.url || '';
  return '';
}

export function deepLink(msg) {
  const text = encodeURIComponent(msg.body);
  const to = String(msg.to || '');
  if (msg.channel === 'telegram') {
    const u = to.replace(/^@|https?:\/\/t\.me\//g, '');
    return u ? `https://t.me/${u}` : 'https://t.me/';
  }
  if (msg.channel === 'whatsapp') return `https://wa.me/${to.replace(/\D/g, '')}?text=${text}`;
  if (msg.channel === 'zalo') return `https://zalo.me/${to.replace(/\D/g, '')}`;
  if (msg.channel === 'hh_chat') return to || 'https://hh.ru/';
  if (msg.channel === 'email') return `mailto:${to}?subject=${encodeURIComponent(msg.subject || '')}&body=${text}`;
  return '';
}

R('POST', '/messages/:id/send', 'messages', async (ctx, { params, body }) => {
  const msg = await get(ctx, 'messages', params.id);
  const lead = await get(ctx, 'leads', msg.leadId);
  if (lead.optOut) throw new HttpError(409, 'Контакт попросил больше не писать.');
  const settings = await getSettings(ctx);
  if (msg.channel === 'email' && !body.manual) {
    need(msg.to, 400, 'Нет email получателя. Добавьте его в карточку лида.');
    need(isEmail(msg.to), 400, 'Некорректный email получателя.');
    if (msg.approach === 'harvey') { const g = preSendGate({ to: msg.to, subject: msg.subject, body: msg.body, lead }); if (!g.ok) { msg.status = 'blocked'; msg.gate = g.reasons; await put(ctx, 'messages', msg); throw new HttpError(422, 'Письмо не прошло фильтр: ' + g.reasons.join('; ')); } }
    if (!ctx.services?.mail) throw new HttpError(400, 'Почта не подключена. Раздел «Каналы» → Почта (SMTP).');
    const quota = await sendQuota(ctx, settings);
    if (!body.now || quota.left <= 0) {
      msg.status = 'queued'; msg.queuedAt = nowIso(); await put(ctx, 'messages', msg);
      return { ok: true, queued: true, msg, quota, note: quota.left <= 0 ? 'Дневной лимит прогрева исчерпан — письмо уйдёт в следующее рабочее окно.' : `В очереди: уйдёт в рабочее окно ${settings.sending.windowFrom}:00–${settings.sending.windowTo}:00 с паузой между письмами.` };
    }
    let res;
    try { res = await ctx.services.mail.send(ctx, { to: msg.to, subject: msg.subject, text: msg.body, leadId: lead.id, msgId: msg.id }); }
    catch (e) { if (e instanceof HttpError) throw e; msg.status = 'error'; msg.error = String(e.message).slice(0, 300); await put(ctx, 'messages', msg); throw new HttpError(502, 'Почтовый сервер не принял письмо: ' + msg.error); }
    msg.status = 'sent'; msg.sentAt = nowIso(); msg.providerId = res?.messageId || null;
  } else {
    // Живое касание с личного аккаунта: отмечаем отправленным, возвращаем ссылку на чат.
    msg.status = 'sent'; msg.sentAt = nowIso(); msg.manual = true;
  }
  await put(ctx, 'messages', msg);
  advance(lead, 'contacted');
  lead.lastTouchAt = msg.sentAt;
  await put(ctx, 'leads', lead);
  await audit(ctx, 'message.sent', { id: msg.id, channel: msg.channel });
  return { ok: true, msg, link: deepLink(msg) };
});

export async function sendQuota(ctx, settings) {
  const s = settings.sending;
  const msgs = (await list(ctx, 'messages')).filter(m => m.channel === 'email' && m.status === 'sent' && !m.manual);
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = msgs.filter(m => String(m.sentAt).startsWith(today)).length;
  const firstDay = msgs.map(m => m.sentAt).sort()[0];
  const days = firstDay ? Math.floor((Date.now() - new Date(firstDay)) / 86400000) : 0;
  const warm = Math.min(s.dailyCap, s.warmupStart + s.warmupStep * days);
  return { cap: warm, sentToday, left: Math.max(0, warm - sentToday), warmupDay: days + 1, fullCap: s.dailyCap };
}

R('GET', '/sending/quota', 'messages:read', async (ctx) => sendQuota(ctx, await getSettings(ctx)));

// Ответ собственника: классификация, смена этапа, подсказка ответа, отписка.
R('POST', '/leads/:id/reply', 'messages', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  need(body.text, 400, 'Вставьте текст ответа.');
  const cls = body.kind || classifyReply(body.text);
  const msg = { id: uid('m_'), leadId: lead.id, direction: 'in', channel: body.channel || 'email', body: body.text, status: 'received', kind: cls };
  await put(ctx, 'messages', msg);
  const outs = (await list(ctx, 'messages')).filter(m => m.leadId === lead.id && m.direction === 'out' && m.status === 'sent');
  for (const o of outs) if (!o.repliedAt) { o.repliedAt = nowIso(); o.replyKind = cls; await put(ctx, 'messages', o); }
  if (cls === 'unsubscribe' || cls === 'negative') { lead.optOut = cls === 'unsubscribe'; advance(lead, 'lost'); }
  else advance(lead, 'replied');
  lead.lastReply = { at: nowIso(), kind: cls, text: body.text };
  await put(ctx, 'leads', lead);
  const slots = nextSlots();
  const suggestion = (REPLY_PLAYBOOK[cls] || REPLY_PLAYBOOK.question).replace('{slots}', slots).replace('{answer}', '(ответ по сути вопроса)');
  if (ctx.services?.notify) await Promise.resolve(ctx.services.notify(ctx, `💬 Ответ от ${lead.owner?.name || lead.company}: ${cls}\n${body.text.slice(0, 300)}`)).catch(() => {});
  return { kind: cls, suggestion, lead };
});

function nextSlots() {
  const d = new Date(); const out = [];
  while (out.length < 2) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) out.push(d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) + (out.length ? ' в 15:00' : ' в 11:00')); }
  return out.join(' или ');
}

// ---------- HeadHunter ----------
R('POST', '/hh/search', 'leads', async (ctx, { body }) => {
  const settings = await getSettings(ctx);
  const cfg = { ...settings.hh, ...body };
  if (!ctx.services?.hh) throw new HttpError(400, 'HH не подключён.');
  const queries = buildHhQueries(cfg);
  const seen = new Set(); const out = []; const errors = [];
  const existing = new Set((await list(ctx, 'leads')).map(l => l.sourceRef).filter(Boolean));
  for (const q of queries) {
    try {
      const res = await ctx.services.hh.search(ctx, q);
      for (const v of res.items || []) {
        if (seen.has(v.id)) continue; seen.add(v.id);
        const lead = vacancyToLead(v, { niche: cfg.niche, filters: cfg });
        out.push({ raw: v, preview: { company: lead.company, title: lead.vacancy.title, salary: lead.vacancy.salaryRub, area: lead.vacancy.area, score: lead.score, scoring10: Math.round(lead.score / 10), reasons: lead.scoreReasons, stops: lead.stops, flags: lead.flags, url: lead.vacancy.url, imported: existing.has(lead.sourceRef) } });
      }
    } catch (e) { errors.push(q.text + ': ' + e.message); }
  }
  out.sort((a, b) => b.preview.score - a.preview.score);
  return { total: out.length, items: out.filter(x => x.preview.score >= (cfg.minScore || 0)), hidden: out.filter(x => x.preview.score < (cfg.minScore || 0)).length, errors };
});

R('POST', '/hh/import', 'leads', async (ctx, { body }) => {
  const items = body.items || [];
  const existing = new Set((await list(ctx, 'leads')).map(l => l.sourceRef).filter(Boolean));
  const created = [];
  for (const raw of items) {
    let v = raw;
    if (ctx.services?.hh?.vacancy && !raw.description) { try { v = { ...raw, ...(await ctx.services.hh.vacancy(ctx, raw.id)) }; } catch { /* оставляем краткую версию */ } }
    const lead = vacancyToLead(v, { niche: body.niche, filters: (await getSettings(ctx)).hh });
    if (existing.has(lead.sourceRef)) continue;
    if (ctx.services?.hh?.employer && v.employer?.id) {
      try {
        const emp = await ctx.services.hh.employer(ctx, v.employer.id);
        lead.site = emp.site_url || '';
        lead.employerInfo = { open_vacancies: emp.open_vacancies, industries: (emp.industries || []).map(i => i.name), area: emp.area?.name };
        if (emp.open_vacancies != null) mergeFacts(lead, [{ kind: 'employer', text: `сейчас у компании ${emp.open_vacancies} открытых вакансий на hh.ru`, source: emp.alternate_url || 'hh.ru' }]);
      } catch { /* карточка работодателя недоступна */ }
    }
    lead.id = uid('l_');
    await put(ctx, 'leads', lead);
    created.push(lead);
  }
  await audit(ctx, 'hh.import', { n: created.length });
  return { created: created.length, leads: created };
});

// ---------- inbound webhooks (любой сайт, реклама, VK, Telegram) ----------
export async function inboundLead(ctx, channel, payload = {}) {
  const p = flatten(payload);
  const lead = {
    id: uid('l_'), stage: 'new', source: 'inbound:' + channel, score: 70,
    company: p.company || p.компания || '', site: safeUrl(p.site), city: p.city || '',
    owner: { name: p.name || p.имя || p.full_name || '', role: p.role || 'Заявка', social: { telegram: p.telegram || '' } },
    contacts: { emails: [p.email].filter(isEmail), phones: [p.phone || p.телефон].filter(Boolean).map(x => String(x).replace(/[^\d+()\- ]/g, '').slice(0, 30)) },
    facts: [], hypotheses: [{ pain: p.message || p.comment || 'Входящая заявка — уточнить задачу на созвоне.', offerId: 'audit' }],
    utm: { source: p.utm_source, medium: p.utm_medium, campaign: p.utm_campaign, content: p.utm_content, term: p.utm_term },
    notes: p.message || p.comment || '',
  };
  await put(ctx, 'leads', lead);
  await audit(ctx, 'lead.inbound', { id: lead.id, channel });
  if (ctx.services?.notify) await Promise.resolve(ctx.services.notify(ctx, `🆕 Заявка (${channel}): ${lead.owner.name || ''} ${lead.contacts.phones[0] || lead.contacts.emails[0] || ''}\n${lead.notes}`)).catch(() => {});
  return lead;
}
function flatten(o, out = Object.create(null), depth = 0) {
  if (depth > 6) return out;
  for (const [k, v] of Object.entries(o || {})) {
    const key = String(k).toLowerCase().slice(0, 60);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, out, depth + 1);
    else out[key] = clip(Array.isArray(v) ? v.slice(0, 20).join(', ') : v == null ? '' : String(v), 2000);
  }
  return out;
}

// ---------- experiments ----------
R('GET', '/experiments', 'messages:read', async (ctx) => {
  const exps = await list(ctx, 'experiments');
  const out = [];
  for (const e of exps) out.push({ ...e, stats: await experimentStats(ctx, e) });
  return out;
});

R('POST', '/experiments', 'messages', async (ctx, { body }) => {
  need(body.name && body.variants?.length >= 2, 400, 'Нужны название и минимум 2 варианта.');
  const exp = { id: uid('x_'), name: body.name, hypothesis: body.hypothesis || '', metric: body.metric || 'reply', status: 'running', niche: body.niche || '',
    variants: body.variants.map((v, i) => ({ id: v.id || 'v' + (i + 1), name: v.name || ('Вариант ' + (i + 1)), hook: v.hook, offerId: v.offerId || 'audit' })) };
  await put(ctx, 'experiments', exp);
  return exp;
});

R('PUT', '/experiments/:id', 'messages', async (ctx, { params, body }) => {
  const exp = await get(ctx, 'experiments', params.id);
  for (const k of ['name', 'hypothesis', 'status', 'winner', 'metric']) if (k in body) exp[k] = body[k];
  await put(ctx, 'experiments', exp);
  return exp;
});

export async function experimentStats(ctx, exp) {
  const msgs = (await list(ctx, 'messages')).filter(m => m.experimentId === exp.id && m.direction === 'out' && m.status === 'sent' && !m.followUp);
  const leads = Object.fromEntries((await list(ctx, 'leads')).map(l => [l.id, l]));
  const variants = exp.variants.map(v => {
    const vm = msgs.filter(m => m.variantId === v.id);
    const leadIds = [...new Set(vm.map(m => m.leadId))];
    const ok = leadIds.filter(id => {
      const l = leads[id]; if (!l) return false;
      if (exp.metric === 'meeting') return stageIndex(l.stage) >= stageIndex('meeting') && l.stage !== 'lost';
      return !!vm.find(m => m.leadId === id && m.repliedAt && !['negative', 'unsubscribe'].includes(m.replyKind));
    }).length;
    return { id: v.id, n: leadIds.length, k: ok };
  });
  const ev = evaluate(variants);
  ev.rows = ev.rows.map(r => ({ ...r, name: exp.variants.find(v => v.id === r.id)?.name, hook: exp.variants.find(v => v.id === r.id)?.hook }));
  return ev;
}

// ---------- meetings, scripts, calls ----------
R('POST', '/leads/:id/meeting', 'meetings', async (ctx, { params, body }) => {
  const lead = await get(ctx, 'leads', params.id);
  const at = body.at && !Number.isNaN(new Date(body.at).getTime()) ? new Date(body.at).toISOString() : new Date(Date.now() + 86400000).toISOString();
  const mt = { id: uid('mt_'), leadId: lead.id, at, status: 'scheduled', link: safeUrl(body.link), notes: clip(body.notes || '', 2000) };
  await put(ctx, 'meetings', mt);
  advance(lead, 'meeting');
  await put(ctx, 'leads', lead);
  if (ctx.services?.notify) await Promise.resolve(ctx.services.notify(ctx, `📅 Встреча: ${lead.owner?.name || ''} (${lead.company}) — ${new Date(mt.at).toLocaleString('ru-RU')}`)).catch(() => {});
  return mt;
});

R('GET', '/meetings', 'meetings:read', async (ctx) => {
  const leads = Object.fromEntries((await list(ctx, 'leads')).map(l => [l.id, l]));
  return (await list(ctx, 'meetings')).map(m => ({ ...m, lead: leads[m.leadId] ? { id: m.leadId, company: leads[m.leadId].company, owner: leads[m.leadId].owner?.name } : null })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
});

R('PUT', '/meetings/:id', 'meetings', async (ctx, { params, body }) => {
  const mt = await get(ctx, 'meetings', params.id);
  for (const k of ['at', 'status', 'notes', 'outcome']) if (k in body) mt[k] = clip(body[k], 2000);
  if ('link' in body) mt.link = safeUrl(body.link);
  await put(ctx, 'meetings', mt);
  return mt;
});

R('GET', '/leads/:id/script', 'meetings:read', async (ctx, { params }) => {
  const lead = await get(ctx, 'leads', params.id);
  const settings = await getSettings(ctx);
  return buildCallScript({ lead, me: settings.me, usdRate: settings.usdRate, offers: settings.offers });
});

R('POST', '/calls', 'calls', async (ctx, { body }) => {
  need(body.transcript && body.transcript.length > 30, 400, 'Вставьте расшифровку разговора (или загрузите аудио).');
  await spend(ctx, 'call_analysis');
  const settings = await getSettings(ctx);
  const meNames = ['влад', 'я', 'менеджер', settings.me?.name?.split(' ')[0]?.toLowerCase()].filter(Boolean);
  const analysis = analyzeCall(body.transcript, { me: meNames });
  let deep = null;
  if (body.deep !== false && ctx.services?.llm && await ctx.services.llm.available(ctx)) {
    try { deep = await ctx.services.llm.analyzeCall(ctx, { transcript: body.transcript, analysis, lead: body.leadId ? await S(ctx).get(ctx.ws.id, 'leads', body.leadId) : null }); } catch (e) { deep = { error: e.message }; }
  }
  const call = { id: uid('c_'), leadId: body.leadId || null, meetingId: body.meetingId || null, source: body.source || 'upload', title: body.title || 'Звонок', transcript: body.transcript, analysis, deep };
  await put(ctx, 'calls', call);
  if (body.meetingId) { try { const mt = await get(ctx, 'meetings', body.meetingId); mt.status = 'done'; mt.callId = call.id; await put(ctx, 'meetings', mt); } catch { /* встреча могла быть удалена */ } }
  return call;
});

// mymeet.ai: отправить бота записи на встречу и забрать готовую расшифровку на разбор.
R('POST', '/meetings/:id/record', 'meetings', async (ctx, { params }) => {
  const mt = await get(ctx, 'meetings', params.id);
  need(mt.link, 400, 'У встречи нет ссылки на звонок.');
  need(ctx.services?.mymeet, 400, 'Запись встреч подключается через mymeet.ai в «Каналы → Записи звонков».');
  const lead = await get(ctx, 'leads', mt.leadId);
  const r = await ctx.services.mymeet.record(ctx, { link: mt.link, title: `Встреча: ${lead.company}` });
  mt.mymeetId = r?.id || r?.meeting_id || r?.data?.id || null; mt.recording = true;
  await put(ctx, 'meetings', mt);
  return { ok: true, mymeetId: mt.mymeetId };
});
R('POST', '/meetings/:id/fetch-transcript', 'calls', async (ctx, { params }) => {
  const mt = await get(ctx, 'meetings', params.id);
  need(mt.mymeetId && ctx.services?.mymeet, 400, 'Для этой встречи нет записи mymeet.ai.');
  const text = await ctx.services.mymeet.transcript(ctx, mt.mymeetId);
  need(typeof text === 'string' && text.length > 30, 409, 'Расшифровка ещё не готова — попробуйте позже.');
  return handle(ctx, 'POST', '/calls', { transcript: text, leadId: mt.leadId, meetingId: mt.id, title: 'Запись mymeet.ai', source: 'mymeet' });
});

R('GET', '/calls', 'calls:read', async (ctx) => (await list(ctx, 'calls')).map(c => ({ ...c, transcript: undefined, transcriptChars: c.transcript?.length || 0 })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
R('GET', '/calls/learn', 'calls:read', async (ctx) => learnFromCalls((await list(ctx, 'calls')).map(c => c.analysis)));
R('GET', '/calls/:id', 'calls:read', async (ctx, { params }) => get(ctx, 'calls', params.id));

// ---------- deals ----------
R('GET', '/deals', 'deals:read', async (ctx) => (await list(ctx, 'deals')).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
R('POST', '/deals', 'deals', async (ctx, { body }) => {
  const lead = await get(ctx, 'leads', body.leadId);
  const settings = await getSettings(ctx);
  const items = (body.items || [{ offerId: body.offerId || 'setup' }]).map(it => {
    const of = settings.offers.find(o => o.id === it.offerId) || {};
    return { offerId: it.offerId, name: it.name || of.name, priceRub: Number(it.priceRub ?? of.priceRub ?? 0) };
  });
  const amount = sum(items, i => i.priceRub);
  const plan = paymentPlan(amount, body.paymentTerm || 'full');
  const deal = { id: uid('d_'), leadId: lead.id, company: lead.company, owner: lead.owner?.name, items, amountRub: amount, payment: { term: plan.term.id, totalRub: plan.totalRub, perPaymentRub: plan.perPaymentRub }, status: body.status || 'open', paidRub: Number(body.paidRub || 0) };
  await put(ctx, 'deals', deal);
  if (deal.status === 'won') { advance(lead, 'won'); await put(ctx, 'leads', lead); }
  await audit(ctx, 'deal.create', { id: deal.id, amount });
  return deal;
});
R('PUT', '/deals/:id', 'deals', async (ctx, { params, body }) => {
  const deal = await get(ctx, 'deals', params.id);
  if ('status' in body) { need(['open', 'won', 'lost'].includes(body.status), 400, 'Некорректный статус сделки.'); deal.status = body.status; }
  if ('paidRub' in body) deal.paidRub = Math.max(0, Number(body.paidRub) || 0);
  await put(ctx, 'deals', deal);
  if (body.status === 'won' || body.status === 'lost') { const lead = await get(ctx, 'leads', deal.leadId); advance(lead, body.status); await put(ctx, 'leads', lead); }
  await audit(ctx, 'deal.update', { id: deal.id, status: deal.status });
  return deal;
});

// ---------- analytics & economics ----------
const analyticsCache = new Map(); // ws → { v, settingsKey, data } — пересчёт только после изменений в кабинете

R('GET', '/analytics', 'analytics', async (ctx) => {
  const v = S(ctx).version ? S(ctx).version(ctx.ws.id) : null;
  const hit = analyticsCache.get(ctx.ws.id);
  if (v !== null && hit && hit.v === v) return structuredClone(hit.data);
  const data = await computeAnalytics(ctx);
  if (v !== null) { analyticsCache.set(ctx.ws.id, { v, data }); if (analyticsCache.size > 5000) analyticsCache.delete(analyticsCache.keys().next().value); }
  return structuredClone(data);
});

async function computeAnalytics(ctx) {
  const [leads, msgs, meetings, deals, calls, channels] = await Promise.all(['leads', 'messages', 'meetings', 'deals', 'calls', 'channels'].map(c => list(ctx, c)));
  const leadById = new Map(leads.map(l => [l.id, l]));
  const settings = await getSettings(ctx);
  const reached = (l, st) => l.stage !== 'lost' ? stageIndex(l.stage) >= stageIndex(st) : (l.history || []).some(h => stageIndex(h.stage) >= stageIndex(st) && h.stage !== 'lost');
  const funnel = ['new', 'researched', 'contacted', 'replied', 'meeting', 'won'].map(st => ({ stage: st, name: STAGES.find(s => s.id === st).name, n: leads.filter(l => reached(l, st)).length }));
  const won = deals.filter(d => d.status === 'won');
  const revenue = sum(won, d => d.amountRub);
  const bySource = Object.entries(groupBy(leads, l => (l.source || 'manual').split(':').pop())).map(([src, ls]) => {
    const ids = new Set(ls.map(l => l.id));
    const ch = channels.find(c => c.type === src);
    return { source: src, leads: ls.length, meetings: ls.filter(l => reached(l, 'meeting')).length, deals: won.filter(d => ids.has(d.leadId)).length, revenueRub: sum(won.filter(d => ids.has(d.leadId)), d => d.amountRub), spendRub: Number(ch?.spendRub || 0) };
  });
  const sent = msgs.filter(m => m.direction === 'out' && m.status === 'sent' && !m.followUp);
  const byHook = Object.entries(groupBy(sent, m => m.hook || '—')).map(([hook, ms]) => {
    const ls = [...new Set(ms.map(m => m.leadId))];
    const rep = ls.filter(id => ms.find(m => m.leadId === id && m.repliedAt && !['negative', 'unsubscribe'].includes(m.replyKind))).length;
    const mt = ls.filter(id => { const l = leadById.get(id); return l && reached(l, 'meeting'); }).length;
    return { hook, name: HOOKS.find(h => h.id === hook)?.name || hook, sent: ls.length, replies: rep, replyRate: pct(rep, ls.length), meetings: mt, meetingRate: pct(mt, ls.length) };
  }).sort((a, b) => b.meetingRate - a.meetingRate || b.replyRate - a.replyRate);
  const contacted = funnel.find(f => f.stage === 'contacted').n;
  const actual = {
    replyRate: pct(funnel.find(f => f.stage === 'replied').n, contacted) / 100,
    meetingRate: pct(funnel.find(f => f.stage === 'meeting').n, funnel.find(f => f.stage === 'replied').n) / 100,
    closeRate: pct(funnel.find(f => f.stage === 'won').n, funnel.find(f => f.stage === 'meeting').n) / 100,
    avgCheckRub: won.length ? round(revenue / won.length) : null,
  };
  return {
    funnel, revenueRub: revenue, revenueFmt: fmtMoney(revenue, settings.usdRate), usdRate: settings.usdRate,
    pipelineRub: sum(deals.filter(d => d.status === 'open'), d => d.amountRub),
    dealsWon: won.length, meetingsScheduled: meetings.filter(m => m.status === 'scheduled').length, calls: calls.length,
    bySource: channelRoi(bySource), byHook, actual,
    conversion: { leadToMeeting: pct(funnel[4].n, funnel[0].n), meetingToDeal: pct(funnel[5].n, funnel[4].n), contactToReply: pct(funnel[3].n, contacted) },
  };
}

R('POST', '/economics/funnel', null, async (ctx, { body }) => funnelModel(body));
R('POST', '/economics/payback', null, async (ctx, { body }) => payback(body));
R('POST', '/economics/saas', null, async (ctx, { body }) => saasModel(body));

// ---------- channels (connectors) ----------
R('GET', '/channels', 'settings', async (ctx) => {
  const saved = Object.fromEntries((await list(ctx, 'channels')).map(c => [c.type, c]));
  return CHANNELS.map(c => {
    const s = saved[c.type] || {};
    const config = {};
    for (const f of c.fields) config[f.k] = f.secret ? (s.config?.[f.k] ? '••••••' + String(s.config[f.k]).slice(-3) : '') : (s.config?.[f.k] ?? '');
    return { ...c, enabled: !!s.enabled, config, spendRub: s.spendRub || 0, webhook: `/api/hooks/lead/${c.type}?key=${s.hookKey || ''}`, hookKey: s.hookKey || '' };
  });
});

R('PUT', '/channels/:type', 'settings', async (ctx, { params, body }) => {
  const def = CHANNELS.find(c => c.type === params.type);
  need(def, 404, 'Нет такого канала.');
  const cur = await S(ctx).get(ctx.ws.id, 'channels', params.type) || { id: params.type, type: params.type, config: {}, hookKey: uid('k') };
  if ('enabled' in body) cur.enabled = !!body.enabled;
  if ('spendRub' in body) cur.spendRub = Math.max(0, Math.min(1e10, Number(body.spendRub) || 0));
  for (const f of def.fields) {
    const v = body.config?.[f.k];
    if (v === undefined || (f.secret && String(v).startsWith('••••'))) continue;
    cur.config[f.k] = f.secret && ctx.services?.secrets ? await ctx.services.secrets.seal(v) : v;
  }
  await put(ctx, 'channels', cur);
  await audit(ctx, 'channel.update', { type: params.type, enabled: cur.enabled });
  return { ok: true };
});

R('POST', '/channels/:type/test', 'settings', async (ctx, { params }) => {
  if (!ctx.services?.testChannel) return { ok: false, message: 'Проверка доступна в серверной версии.' };
  return ctx.services.testChannel(ctx, params.type);
});

// ---------- workspaces / client cabinets ----------
R('POST', '/workspaces', 'settings', async (ctx, { body }) => {
  need(body.name && String(body.name).trim(), 400, 'Название кабинета обязательно.');
  const parent = await S(ctx).getWorkspace(ctx.ws.id);
  const plan = PLANS.find(p => p.id === parent.plan) || PLANS[0];
  const children = (await S(ctx).listWorkspaces()).filter(w => w.parentId === parent.id);
  if (children.length + 1 >= plan.workspaces) throw new HttpError(402, `Тариф «${plan.name}» позволяет ${plan.workspaces} кабинет(ов). Перейдите на тариф выше, чтобы открыть ещё.`);
  // Кредиты не создаются из воздуха: передаются из баланса родительского кабинета.
  const transfer = Math.max(0, Math.floor(Number(body.credits) || 0));
  if (transfer > (parent.credits || 0)) throw new HttpError(402, `Недостаточно кредитов для передачи: доступно ${parent.credits || 0}.`);
  parent.credits = (parent.credits || 0) - transfer;
  await S(ctx).saveWorkspace(parent);
  const childPlan = PLANS.some(p => p.id === body.plan) ? body.plan : 'start';
  const ws = await S(ctx).createWorkspace({ name: clip(String(body.name).trim(), 120), kind: 'client', plan: childPlan, parentId: parent.id, credits: transfer, ownerUserId: ctx.user?.id });
  if (body.template === 'blank') {
    // Чистый тестовый кабинет под другую гипотезу (например, второй продукт): без офферов, кейсов и HH-ролей.
    await S(ctx).put(ws.id, 'settings', { ...defaultSettings(ws), offers: [{ id: 'test', name: 'Тестовый оффер', priceRub: 100000, kind: 'service', desc: 'Опишите продукт и цену' }], proofs: [], hh: { ...defaultSettings(ws).hh, roles: [] }, id: 'main', createdAt: nowIso(), updatedAt: nowIso() });
  } else if (body.cloneFrom !== false) {
    // «Отгрузить идеальную модель»: настройки, офферы, правила и эксперименты. Кейсы клиент вносит свои.
    const settings = await getSettings(ctx);
    const clone = { ...settings, brand: { ...settings.brand, name: ws.name }, proofs: [], onboardingDone: false, autopilot: { ...settings.autopilot, enabled: false } };
    await S(ctx).put(ws.id, 'settings', { ...clone, id: 'main', createdAt: nowIso(), updatedAt: nowIso() });
    for (const e of await list(ctx, 'experiments')) await S(ctx).put(ws.id, 'experiments', { ...e, id: uid('x_'), status: 'running', createdAt: nowIso() });
  }
  if (ctx.onWorkspaceCreated) await ctx.onWorkspaceCreated(ws);
  await audit(ctx, 'workspace.create', { id: ws.id, name: ws.name, credits: transfer });
  return ws;
});

R('POST', '/billing/credits', 'settings', async (ctx, { body }) => {
  const pack = CREDIT_PACKS.find(p => p.id === body.packId);
  need(pack, 400, 'Нет такого пакета.');
  if (!ctx.demo && !ctx.services?.billing) throw new HttpError(400, 'Оплата не подключена: укажите платёжный шлюз (ЮKassa/CloudPayments/Т-Банк) в .env. Пока можно начислить кредиты вручную владельцем.');
  const ws = await S(ctx).getWorkspace(ctx.ws.id);
  ws.credits = (ws.credits || 0) + pack.credits;
  await S(ctx).saveWorkspace(ws);
  await audit(ctx, 'billing.credits', { pack: pack.id });
  return { credits: ws.credits };
});

// ---------- investors / observers ----------
R('GET', '/investors', 'investors', async (ctx) => {
  const a = await handle({ ...ctx, role: 'owner' }, 'GET', '/analytics');
  const chain = ctx.services?.auditVerify ? await ctx.services.auditVerify(ctx) : null;
  return {
    asOf: nowIso(), revenueRub: a.revenueRub, pipelineRub: a.pipelineRub, dealsWon: a.dealsWon,
    funnel: a.funnel, conversion: a.conversion, usdRate: a.usdRate,
    integrity: chain, model: saasModel({}),
  };
});

R('GET', '/audit/verify', 'settings', async (ctx) => ctx.services?.auditVerify ? ctx.services.auditVerify(ctx) : { ok: true, entries: 0, note: 'Журнал целостности доступен в серверной версии.' });
R('GET', '/audit', 'settings', async (ctx, { query }) => ctx.services?.auditList ? ctx.services.auditList(ctx, Number(query.limit) || 100) : []);

// Конвейер, автопилот, hh-отклики, CRM-файл, прогноз — отдельный модуль, без циклических импортов.
export const pipeline = registerPipeline(R, { list, get, put, spend, audit, advance, getSettings, handle, deepLink, sendQuota });
export const growth = registerGrowth(R, { list, get, put, spend, audit, getSettings });

export { routes };
