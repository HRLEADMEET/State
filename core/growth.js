// Рост за пределами hh.ru: источники клиентов, «Харви: почта», валюты рынков, гипотезы по подходам,
// рефералка «Стать агентом», заказы «Нанять продажника / РОПа», плашки «что подключить».
// Регистрируется из router.js через registerGrowth(R, helpers) — без циклических импортов.
import { uid, nowIso, HttpError, need, clip, isEmail, sum, pct, groupBy, safeUrl } from './util.js';
import { PROOFS } from './catalog.js';
import { SOURCES, APPROACHES, recommendSources, orgToLead } from './sources.js';
import { SIGNAL_CATALOG, detectSignals, buildCohort, emailOf, sequence, preSendGate, tzForCity, nextSendTime } from './harvey.js';
import { CURRENCIES, priceInMarkets, rateOf } from './currency.js';
import { vacancyToLead } from './hhSignals.js';

const DAY = 86400000;

/** Подход лида: HH-партизан, Харви (почта по открытым данным) или входящие. */
export function approachOf(l = {}) {
  if (l.approach) return l.approach;
  const s = String(l.source || '');
  if (/^(hh|trudvsem|superjob|crm)/.test(s) || l.vacancy) return 'hh';
  if (/^(twogis|yandex_maps|google_places|egrul|sites|maps|harvey)/.test(s)) return 'harvey';
  return 'inbound';
}

export const ORDER_KINDS = {
  hire_sales: { name: 'Нанять продажника', text: 'Подберём и введём в работу менеджера по продажам под ваш план.' },
  hire_rop: { name: 'Нанять РОПа', text: 'Найдём руководителя отдела продаж, который построит систему без вас.' },
  replace_rop: { name: 'Заменить РОПа', text: 'Аудит текущего РОПа и замена без провала плана.' },
  agent: { name: 'Стать агентом', text: 'Рекомендуете клиентов — получаете процент с оплаты.' },
};

const SETUP = [
  { id: 'hh', title: 'Подключите hh.ru', text: 'User-Agent и токен соискателя — поиск сигналов и отклики.', view: 'channels', done: (c) => c.hh?.enabled },
  { id: 'telegram_bot', title: 'Telegram-бот для уведомлений', text: 'Ответы и заявки — сразу на телефон.', view: 'channels', done: (c) => c.telegram_bot?.enabled },
  { id: 'email', title: 'Почта на своём домене', text: 'SMTP + SPF/DKIM/DMARC — нужно для «Харви: почта». Проверка домена — в «Харви».', view: 'channels', done: (c) => c.email?.enabled },
  { id: 'llm', title: 'Ключ Claude', text: 'Глубокая персонализация писем и разбор звонков.', view: 'channels', done: (c, x) => x.llm },
  { id: 'dadata', title: 'ЕГРЮЛ (DaData)', text: 'Находит руководителя компании, если его нет на сайте.', view: 'channels', done: (c) => c.dadata?.enabled },
  { id: 'metrika', title: 'Яндекс Метрика', text: 'Визиты и цели по utm — чтобы сравнивать рекламные гипотезы.', view: 'hypotheses', done: (c) => c.metrika?.enabled },
  { id: 'stats2', title: 'Второй счётчик (Google Analytics / Roistat)', text: 'Сверка цифр: два источника честнее одного.', view: 'channels', done: (c) => c.stats2?.enabled },
  { id: 'sources', title: 'Ключи карт (2ГИС / Google Places)', text: 'Поиск компаний ниши в городе для режима «Харви».', view: 'sources', done: (c) => c.twogis?.enabled || c.google_places?.enabled || c.yandex_maps?.enabled },
  { id: 'proofs', title: 'Ваши кейсы с цифрами', text: 'Без кейсов письма звучат пусто, а цифры выдумывать нельзя.', view: 'prefs', done: (c, x) => Array.isArray(x.settings.proofs) ? x.settings.proofs.length > 0 : true },
  { id: 'launch', title: 'Пройдите мастер запуска', text: '10 минут — и конвейер работает каждый день.', view: 'launch', done: (c, x) => x.settings.launchDone },
];

export function registerGrowth(R, H) {
  const { list, get, put, spend, audit, getSettings } = H;
  const S = (ctx) => ctx.store;

  const channelsMap = async (ctx) => Object.fromEntries((await list(ctx, 'channels')).map(c => [c.type, c]));

  // ---------- валюты рынков ----------
  R('GET', '/fx/markets', null, async (ctx) => {
    const st = await getSettings(ctx);
    const rates = { ...(st.fx?.rates || {}), ...(ctx.services?.fx ? await ctx.services.fx().catch(() => ({})) : {}) };
    if (!rates.USD) rates.USD = st.usdRate;
    const markets = st.currency?.markets || ['RUB', 'USD', 'KZT', 'VND', 'CNY', 'AED', 'EUR', 'TRY'];
    return {
      currencies: CURRENCIES.map(c => ({ ...c, rate: rateOf(c.code, rates) })), markets, second: st.currency?.second || 'USD',
      offers: (st.offers || []).filter(o => o.priceRub).map(o => ({ id: o.id, name: o.name, priceRub: o.priceRub, prices: priceInMarkets(o.priceRub, markets, rates) })),
      source: ctx.services?.fx ? 'ЦБ РФ (cbr-xml-daily.ru), обновление раз в 6 часов' : 'ориентировочные курсы — обновите в Настройках',
    };
  });

  // ---------- источники ----------
  R('GET', '/sources', 'leads:read', async (ctx, { query }) => {
    const ch = await channelsMap(ctx);
    const keyed = (id) => ['trudvsem', 'hh', 'hh_kz'].includes(id) || !!ch[id]?.enabled || ctx.demo;
    const rec = recommendSources({ niche: query.niche || 'all', market: query.market || 'RU', budget: query.budget || 'low' });
    const leads = await list(ctx, 'leads');
    const bySrc = groupBy(leads, l => String(l.source || 'manual').split(':')[0]);
    return { approaches: APPROACHES, sources: (rec.length ? rec : SOURCES).map(s => ({ ...s, ready: s.mode !== 'api' || keyed(s.id), searchable: !!ctx.services?.sources?.[s.id], leads: (bySrc[s.id] || []).length })) };
  });

  R('POST', '/sources/search', 'leads', async (ctx, { body }) => {
    const src = SOURCES.find(s => s.id === body.source);
    need(src, 400, 'Нет такого источника.');
    const fn = ctx.services?.sources?.[src.id];
    if (!fn) throw new HttpError(400, src.mode === 'api' ? `«${src.name}»: поиск доступен в серверной версии после подключения ключа.` : `«${src.name}» — ручной источник: выгрузите список и импортируйте CSV в «Сигналах».`);
    const q = { query: clip(String(body.query || 'руководитель отдела продаж'), 200), city: clip(String(body.city || ''), 80) };
    const r = await fn(ctx, q);
    const existing = new Set((await list(ctx, 'leads')).map(l => l.sourceRef).filter(Boolean));
    const st = await getSettings(ctx);
    const items = (r.items || []).slice(0, 100).map(raw => {
      const lead = r.kind === 'vacancy' ? { ...vacancyToLead(raw, { filters: st.hh }), source: src.id, approach: 'hh' } : orgToLead({ ...raw, city: raw.city || q.city }, src.id);
      if (r.kind === 'vacancy') lead.sourceRef = `${src.id}:${raw.id}`;
      return { raw, kind: r.kind, preview: { company: lead.company, title: lead.vacancy?.title || raw.address || '', score: lead.score, site: lead.site || raw.site || '', city: lead.city || lead.vacancy?.area || q.city, email: emailOf(lead), imported: existing.has(lead.sourceRef) } };
    }).sort((a, b) => b.preview.score - a.preview.score);
    return { source: src.id, kind: r.kind, total: items.length, items };
  });

  R('POST', '/sources/import', 'leads', async (ctx, { body }) => {
    const src = SOURCES.find(s => s.id === body.source);
    need(src, 400, 'Нет такого источника.');
    const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
    const existing = new Set((await list(ctx, 'leads')).map(l => l.sourceRef).filter(Boolean));
    const st = await getSettings(ctx);
    const created = [];
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const base = body.kind === 'vacancy' ? { ...vacancyToLead(raw, { filters: st.hh }), source: src.id, approach: 'hh', sourceRef: `${src.id}:${raw.id}` } : orgToLead(raw, src.id);
      if (base.sourceRef && existing.has(base.sourceRef)) continue;
      const lead = { id: uid('l_'), stage: 'new', ...base, site: safeUrl(base.site), contacts: { ...base.contacts, emails: (base.contacts?.emails || []).filter(isEmail) }, createdAt: nowIso() };
      lead.signals = detectSignals(lead);
      await put(ctx, 'leads', lead); created.push(lead.id); existing.add(lead.sourceRef);
    }
    await audit(ctx, 'sources.import', { source: src.id, n: created.length });
    return { created: created.length, ids: created };
  });

  // ---------- Харви: почта ----------
  const harveyMsgs = async (ctx) => (await list(ctx, 'messages')).filter(m => m.approach === 'harvey');

  R('GET', '/harvey', 'messages:read', async (ctx) => {
    const st = await getSettings(ctx);
    const leads = await list(ctx, 'leads');
    const msgs = await harveyMsgs(ctx);
    const touched = new Set((await list(ctx, 'messages')).filter(m => m.direction === 'out').map(m => m.leadId));
    const confirmed = st.harvey?.signals || ['HIRING_SALES', 'NO_TEAM_PAGE_OWNER', 'CHAT_NO_CRM', 'MULTI_BRANCH'];
    const withEmail = leads.filter(l => emailOf(l) && !l.optOut && !l.demo);
    const signals = SIGNAL_CATALOG.map(s => ({ code: s.code, label: s.label, why: s.why, confirmed: confirmed.includes(s.code), leads: withEmail.filter(l => detectSignals(l).includes(s.code)).length }));
    const cohort = buildCohort(leads, confirmed, { touched, limit: 50 }).map(x => ({ id: x.lead.id, company: x.lead.company, owner: x.lead.owner?.name || '', email: emailOf(x.lead), city: x.lead.city || x.lead.vacancy?.area || '', signals: x.signals, emailCheck: x.lead.emailCheck || null }));
    const outbox = msgs.filter(m => ['approved', 'scheduled', 'queued', 'blocked'].includes(m.status)).sort((a, b) => String(a.sendAfter || a.createdAt).localeCompare(String(b.sendAfter || b.createdAt)))
      .map(m => ({ id: m.id, leadId: m.leadId, to: m.to, subject: m.subject, body: m.body, step: m.step, status: m.status, sendAfter: m.sendAfter, gate: m.gate }));
    const sent = msgs.filter(m => m.status === 'sent' && m.step === 1);
    const replied = sent.filter(m => m.repliedAt && !['negative', 'unsubscribe'].includes(m.replyKind));
    return { signals, confirmed, cohort, outbox, stats: { sent: sent.length, replies: replied.length, replyRate: pct(replied.length, sent.length), scheduled: msgs.filter(m => m.status === 'scheduled').length }, autopilot: !!st.harvey?.autopilot };
  });

  R('PUT', '/harvey', 'messages', async (ctx, { body }) => {
    const st = await getSettings(ctx);
    const codes = new Set(SIGNAL_CATALOG.map(s => s.code));
    st.harvey = { ...(st.harvey || {}), ...(Array.isArray(body.signals) ? { signals: body.signals.filter(c => codes.has(c)) } : {}), ...('autopilot' in body ? { autopilot: !!body.autopilot } : {}) };
    await put(ctx, 'settings', st);
    return st.harvey;
  });

  /** Собрать когорту и подготовить по каждому 2 письма: первое — на одобрение, второе — через 3 дня, если нет ответа. */
  R('POST', '/harvey/launch', 'messages', async (ctx, { body }) => {
    const st = await getSettings(ctx);
    const leads = await list(ctx, 'leads');
    const touched = new Set((await list(ctx, 'messages')).filter(m => m.direction === 'out').map(m => m.leadId));
    const cohort = buildCohort(leads, st.harvey?.signals || ['HIRING_SALES', 'NO_TEAM_PAGE_OWNER', 'CHAT_NO_CRM', 'MULTI_BRANCH'], { touched, limit: Math.min(50, Number(body.limit) || 20) });
    const proofs = Array.isArray(st.proofs) ? st.proofs : (ctx.ws.kind === 'client' ? [] : PROOFS);
    let created = 0, blocked = 0, noMx = 0; const errors = [];
    for (const { lead, signals } of cohort) {
      const to = emailOf(lead);
      if (!lead.emailCheck && ctx.services?.dns?.recipientMx) {
        lead.emailCheck = await ctx.services.dns.recipientMx(to.split('@')[1]).catch(() => 'unknown');
        await put(ctx, 'leads', lead);
      }
      if (lead.emailCheck === 'no_mx') { noMx++; continue; }
      const [e1, e2] = sequence({ lead, signals, me: st.me, proofs });
      const gate = preSendGate({ to, subject: e1.subject, body: e1.body, lead });
      try { await spend(ctx, 'message', 2); } catch (e) { errors.push(e.message); break; }
      const tz = tzForCity(lead.city || lead.vacancy?.area || '');
      const t1 = nextSendTime(new Date(), tz);
      const seq = uid('q_');
      const base = { leadId: lead.id, direction: 'out', channel: 'email', to, approach: 'harvey', hook: 'harvey_' + (signals[0] || 'owner').toLowerCase(), seq, tz, signals, followUp: 0 };
      await put(ctx, 'messages', { ...base, id: uid('m_'), step: 1, subject: e1.subject, body: e1.body, status: gate.ok ? 'approved' : 'blocked', gate: gate.reasons, sendAfter: t1.toISOString() });
      await put(ctx, 'messages', { ...base, id: uid('m_'), step: 2, followUp: 1, subject: e2.subject, body: e2.body, status: 'scheduled', sendAfter: nextSendTime(new Date(t1.getTime() + e2.delayDays * DAY), tz).toISOString() });
      lead.approach ||= 'harvey'; lead.signals = signals; await put(ctx, 'leads', lead);
      if (gate.ok) created++; else blocked++;
    }
    await audit(ctx, 'harvey.launch', { created, blocked, noMx });
    return { cohort: cohort.length, created, blocked, noMx, errors, note: 'Первые письма ждут одобрения в «Исходящих». После одобрения уйдут в рабочее время получателя с паузами и прогревом.' };
  });

  /** Одобрить письма: проходят фильтр ещё раз и встают в почтовую очередь. */
  R('POST', '/harvey/approve', 'messages', async (ctx, { body }) => {
    const ids = new Set(Array.isArray(body.ids) ? body.ids : []);
    const msgs = (await harveyMsgs(ctx)).filter(m => m.status === 'approved' && (!ids.size || ids.has(m.id)));
    let queued = 0, blocked = 0;
    for (const m of msgs) {
      const lead = await get(ctx, 'leads', m.leadId).catch(() => null);
      const gate = preSendGate({ to: m.to, subject: m.subject, body: m.body, lead: lead || {} });
      if (!gate.ok) { m.status = 'blocked'; m.gate = gate.reasons; blocked++; }
      else { m.status = 'queued'; m.queuedAt = nowIso(); m.approvedBy = ctx.user?.id || null; queued++; }
      await put(ctx, 'messages', m);
    }
    return { queued, blocked, mode: ctx.services?.mail ? 'smtp' : 'none' };
  });

  R('PUT', '/harvey/messages/:id', 'messages', async (ctx, { params, body }) => {
    const m = await get(ctx, 'messages', params.id);
    need(m.approach === 'harvey' && m.status !== 'sent', 400, 'Это письмо уже отправлено или не из «Харви».');
    if (typeof body.subject === 'string') m.subject = clip(body.subject, 200);
    if (typeof body.body === 'string') m.body = clip(body.body, 20000);
    if (body.status === 'skipped') m.status = 'skipped';
    else if (m.status === 'blocked') { const g = preSendGate({ to: m.to, subject: m.subject, body: m.body }); m.status = g.ok ? 'approved' : 'blocked'; m.gate = g.reasons; }
    await put(ctx, 'messages', m);
    return m;
  });

  R('GET', '/harvey/domain', 'settings', async (ctx, { query }) => {
    need(query.domain, 400, 'Укажите домен, с которого отправляете письма.');
    if (!ctx.services?.dns?.domainHealth) return { domain: query.domain, checks: [{ id: 'demo', ok: null, text: 'Проверка DNS доступна в серверной версии.' }], ok: null };
    return ctx.services.dns.domainHealth(clip(String(query.domain), 200), clip(String(query.dkim || ''), 60));
  });

  // ---------- гипотезы: HH-партизан против Харви (и входящих) ----------
  R('GET', '/hypotheses', 'analytics', async (ctx) => {
    const [leads, msgs, deals] = await Promise.all(['leads', 'messages', 'deals'].map(c => list(ctx, c)));
    const won = deals.filter(d => d.status === 'won');
    const contacted = new Set(msgs.filter(m => m.direction === 'out' && m.status === 'sent').map(m => m.leadId));
    const rows = Object.entries(APPROACHES).map(([id, a]) => {
      const ls = leads.filter(l => approachOf(l) === id);
      const ids = new Set(ls.map(l => l.id));
      const c = ls.filter(l => contacted.has(l.id)).length;
      const rep = ls.filter(l => l.lastReply && !['negative', 'unsubscribe'].includes(l.lastReply.kind)).length;
      const mt = ls.filter(l => ['meeting', 'won'].includes(l.stage) || (l.history || []).some(h => h.stage === 'meeting')).length;
      const w = won.filter(d => ids.has(d.leadId));
      return { id, name: a.name, idea: a.idea, leads: ls.length, contacted: c, replies: rep, replyRate: pct(rep, c), meetings: mt, meetingRate: pct(mt, c), deals: w.length, revenueRub: sum(w, d => d.amountRub) };
    });
    let traffic = null;
    if (ctx.services?.metrika) { try { traffic = await ctx.services.metrika(ctx); } catch (e) { traffic = { error: e.message }; } }
    const best = rows.filter(r => r.contacted >= 10).sort((a, b) => b.meetingRate - a.meetingRate || b.replyRate - a.replyRate)[0] || null;
    return { rows, traffic, verdict: best ? `Лидер по встречам: «${best.name}» — ${best.meetingRate}% встреч от написанных.` : 'Нужно хотя бы 10 касаний по каждому подходу, чтобы сравнивать честно.' };
  });

  // ---------- рефералка и заказы ----------
  async function refCode(ctx) {
    const st = await getSettings(ctx);
    if (st.referral?.code) return st;
    st.referral = { percent: 10, ...(st.referral || {}), code: uid('').replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() };
    await put(ctx, 'settings', st);
    if (S(ctx).kvSet) S(ctx).kvSet('ref:' + st.referral.code, ctx.ws.id);
    return st;
  }

  R('GET', '/referral', null, async (ctx) => {
    const st = await refCode(ctx);
    const refs = await list(ctx, 'referrals');
    return { code: st.referral.code, percent: st.referral.percent, path: `/?ref=${st.referral.code}`, invited: refs.length, paidRub: sum(refs, r => r.paidRub || 0), earnedRub: Math.round(sum(refs, r => r.paidRub || 0) * st.referral.percent / 100), list: refs.slice(-50).map(r => ({ at: r.createdAt, name: r.name || 'Новый кабинет', paidRub: r.paidRub || 0 })) };
  });

  R('POST', '/orders', null, async (ctx, { body }) => {
    const kind = ORDER_KINDS[body.kind] ? body.kind : null;
    need(kind, 400, 'Выберите, что заказать.');
    const order = { id: uid('o_'), kind, title: ORDER_KINDS[kind].name, contact: clip(String(body.contact || ctx.user?.email || ''), 200), details: clip(String(body.details || ''), 2000), status: 'new', fromWs: ctx.ws.id, fromUser: ctx.user?.id || null, createdAt: nowIso() };
    need(order.contact, 400, 'Оставьте телефон, Telegram или email — менеджер свяжется.');
    await put(ctx, 'orders', order);
    // Заявка клиента уходит и владельцу родительского кабинета (агентству), если он есть.
    const ws = await S(ctx).getWorkspace(ctx.ws.id);
    if (ws?.parentId) await S(ctx).put(ws.parentId, 'orders', { ...order, id: uid('o_'), fromName: ws.name, updatedAt: nowIso() });
    if (ctx.services?.notify) await Promise.resolve(ctx.services.notify(ctx, `🧾 Заявка «${order.title}» от ${ws?.name || ''}\nКонтакт: ${order.contact}\n${order.details.slice(0, 300)}`)).catch(() => {});
    await audit(ctx, 'order.create', { kind });
    return { ok: true, order, text: 'Заявка принята. Менеджер свяжется в течение рабочего дня.' };
  });

  R('GET', '/orders', 'settings', async (ctx) => (await list(ctx, 'orders')).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  R('PUT', '/orders/:id', 'settings', async (ctx, { params, body }) => {
    const o = await get(ctx, 'orders', params.id);
    if (['new', 'in_work', 'done', 'rejected'].includes(body.status)) o.status = body.status;
    await put(ctx, 'orders', o); return o;
  });

  // ---------- плашки «что подключить» ----------
  R('GET', '/setup', 'settings', async (ctx) => {
    const st = await getSettings(ctx);
    const ch = await channelsMap(ctx);
    const x = { settings: st, llm: !!(ctx.services?.llm?.available && await ctx.services.llm.available(ctx)) };
    const dismissed = new Set(st.dismissed || []);
    const items = SETUP.map(s => ({ id: s.id, title: s.title, text: s.text, view: s.view, done: !!s.done(ch, x) }));
    return { items: items.filter(i => !i.done && !dismissed.has(i.id)), done: items.filter(i => i.done).length, total: items.length };
  });
  R('POST', '/setup/dismiss', 'settings', async (ctx, { body }) => {
    const st = await getSettings(ctx);
    need(SETUP.some(s => s.id === body.id) || body.id === '*', 400, 'Нет такой плашки.');
    st.dismissed = body.id === '*' ? SETUP.map(s => s.id) : [...new Set([...(st.dismissed || []), body.id])];
    await put(ctx, 'settings', st);
    return { ok: true };
  });

  return {
    /** Второе письмо Харви встаёт в очередь в срок, если нет ответа; при ответе или отписке — отменяется. */
    async harveyTick(ctx, now = Date.now()) {
      const msgs = await harveyMsgs(ctx);
      let moved = 0;
      for (const m of msgs.filter(x => x.status === 'scheduled' && Date.parse(x.sendAfter) <= now)) {
        const lead = await get(ctx, 'leads', m.leadId).catch(() => null);
        const first = msgs.find(x => x.seq === m.seq && x.step === 1);
        const stop = !lead || lead.optOut || lead.lastReply || !first || first.status === 'skipped';
        if (!stop && first.status !== 'sent') continue; // первое ещё не ушло — ждём
        if (stop) m.status = 'skipped';
        else { const g = preSendGate({ to: m.to, subject: m.subject, body: m.body, lead }); m.status = g.ok ? 'queued' : 'blocked'; m.gate = g.reasons; m.queuedAt = nowIso(); moved++; }
        await put(ctx, 'messages', m);
      }
      return moved;
    },
  };
}
