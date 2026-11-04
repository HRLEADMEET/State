// Конвейер касаний (телефон: «скопировать → открыть чат → отправлено»), автопилот (утро/вечер),
// hh-отклики через API с передачей капчи человеку, импорт/экспорт CRM-файла агента, прогноз «Что даст 100».
// Регистрируется из router.js через registerPipeline(R, helpers) — без циклических импортов.
import { uid, nowIso, HttpError, need, clip } from './util.js';
import { PROOFS, STAGES } from './catalog.js';
import { responseLetter, dialogSteps, followUpCadence, meetingSlots, meetingRecord, vacancyFlags } from './hhPlaybook.js';
import { vacancyToLead, buildHhQueries } from './hhSignals.js';
import { parseCsv, toCsv, rowsToLeads, leadsToRows } from './crmCsv.js';
import { forecast, clientText } from './forecast.js';
import { vacancyCost } from './economics.js';
import { fmtRub } from './util.js';
import { plural } from './ru.js';
import { packaging } from './packaging.js';

const DAY = 86400000;
const stageIndex = (id) => STAGES.findIndex(s => s.id === id);
const localDate = (tz, d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const localHour = (tz, d = new Date()) => +new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hour: '2-digit', hourCycle: 'h23' }).format(d);

export function registerPipeline(R, H) {
  const { list, get, put, spend, audit, advance, getSettings, handle, deepLink, sendQuota } = H;

  const proofsFor = (ctx, settings) => (Array.isArray(settings.proofs) ? settings.proofs : (ctx.ws.kind === 'client' ? [] : PROOFS));

  /** Сколько отправлено сегодня по каждому каналу и сколько осталось до дневного лимита. */
  async function capsToday(ctx, settings) {
    const today = new Date().toISOString().slice(0, 10);
    const msgs = (await list(ctx, 'messages')).filter(m => m.direction === 'out' && m.status === 'sent' && String(m.sentAt).startsWith(today));
    const caps = settings.caps || {};
    const out = {};
    for (const ch of ['telegram', 'whatsapp', 'zalo', 'hh_apply', 'hh_chat', 'email']) {
      const used = msgs.filter(m => m.channel === ch).length;
      let cap = caps[ch];
      if (ch === 'email') cap = (await sendQuota(ctx, settings)).cap;
      out[ch] = { used, cap: cap ?? null, left: cap == null ? null : Math.max(0, cap - used) };
    }
    return out;
  }

  function pickChannel(lead, settings, ctx, hhReady) {
    const hasHhApi = !!(ctx.services?.hh?.apply) && hhReady;
    if (lead.vacancy?.id && hasHhApi && ['new', 'researched'].includes(lead.stage) && !lead.hh?.negotiationId) return 'hh_apply';
    if (lead.owner?.social?.telegram) return 'telegram';
    if (lead.contacts?.ownerEmail || lead.contacts?.emails?.length) return 'email';
    if (lead.contacts?.phones?.length) return 'whatsapp';
    if (lead.vacancy?.url) return 'hh_chat';
    return 'email';
  }

  async function prepareQueue(ctx, { limit = 20, research = true } = {}) {
    const settings = await getSettings(ctx);
    const [leads, msgs, exps] = await Promise.all([list(ctx, 'leads'), list(ctx, 'messages'), list(ctx, 'experiments')]);
    const touched = new Set(msgs.filter(m => m.direction === 'out' && m.status !== 'skipped').map(m => m.leadId));
    const exp = exps.find(e => e.status === 'running');
    const hhDoc = await ctx.store.get(ctx.ws.id, 'channels', 'hh');
    const hhReady = !!(ctx.demo || (hhDoc?.enabled && hhDoc?.config?.applicantToken && (hhDoc?.config?.resumeId || settings.hh?.resumeId)));
    const fresh = leads.filter(l => !l.optOut && !l.demo && ['new', 'researched'].includes(l.stage) && !touched.has(l.id) && !(l.stops || []).length)
      .sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
    let created = 0, researched = 0; const errors = [];
    for (const lead of fresh) {
      try {
        let l = lead;
        if (research && l.stage === 'new' && (l.site || l.owner?.social?.telegram)) { l = (await handle(ctx, 'POST', `/leads/${l.id}/research`, {})).lead; researched++; }
        const channel = pickChannel(l, settings, ctx, hhReady);
        let body, subject = '', hook, experimentId = null, variantId = null, flags = [];
        if (channel === 'hh_apply' || channel === 'hh_chat') {
          const r = responseLetter({ lead: l, settings }); body = r.text; hook = 'hh_letter'; flags = r.flags;
          await spend(ctx, 'message');
        } else {
          const d = await handle(ctx, 'POST', `/leads/${l.id}/draft`, { channel, experimentId: exp?.id, useLlm: settings.llm?.enabled !== false });
          body = d.body; subject = d.subject; hook = d.hook; experimentId = d.experimentId; variantId = d.variantId;
        }
        await handle(ctx, 'POST', `/leads/${l.id}/messages`, { body, subject, channel, hook, experimentId, variantId, status: 'approved' });
        if (flags.some(f => f.human)) { const lead2 = await get(ctx, 'leads', l.id); lead2.flags = flags; await put(ctx, 'leads', lead2); }
        created++;
      } catch (e) { errors.push(`${lead.company}: ${e.message}`); if (e.status === 402) break; }
    }
    // Дожимы: написали ≥2 дней назад, ответа нет, дожимов меньше двух.
    let followUps = 0;
    const now = Date.now();
    const pending = new Set(msgs.filter(m => m.status === 'approved').map(m => m.leadId));
    for (const l of leads.filter(x => x.stage === 'contacted' && !x.optOut && !x.demo && x.lastTouchAt && now - new Date(x.lastTouchAt) > 2 * DAY && !pending.has(x.id))) {
      const outs = msgs.filter(m => m.leadId === l.id && m.direction === 'out' && m.status === 'sent');
      if (!outs.length || outs.some(m => m.repliedAt) || outs.some(m => /^hh_/.test(m.channel))) continue;
      const step = outs.filter(m => m.followUp).length + 1;
      if (step > 2) continue;
      try {
        const d = await handle(ctx, 'POST', `/leads/${l.id}/draft`, { followUp: step, channel: outs[0].channel });
        await handle(ctx, 'POST', `/leads/${l.id}/messages`, { body: d.body, subject: d.subject, channel: outs[0].channel, hook: d.hook, followUp: step, status: 'approved' });
        followUps++;
      } catch (e) { errors.push(`${l.company}: ${e.message}`); }
    }
    await audit(ctx, 'queue.prepare', { created, followUps });
    return { created, researched, followUps, errors };
  }

  async function queueItems(ctx) {
    const [msgs, leads] = await Promise.all([list(ctx, 'messages'), list(ctx, 'leads')]);
    const byId = Object.fromEntries(leads.map(l => [l.id, l]));
    const now = Date.now();
    return msgs.filter(m => m.status === 'approved' && (!m.snoozeUntil || new Date(m.snoozeUntil) <= now) && byId[m.leadId] && !byId[m.leadId].optOut)
      .map(m => { const l = byId[m.leadId]; return { ...m, link: deepLink({ ...m, to: m.to || (m.channel === 'hh_chat' && l.hh?.chatId ? 'https://chatik.hh.ru/chat/' + l.hh.chatId : m.to) }), lead: { id: l.id, company: l.company, owner: l.owner?.name, score: l.score, stage: l.stage, vacancy: l.vacancy?.title, vacancyUrl: l.vacancy?.url, flags: l.flags || [], captchaUrl: l.hh?.captchaUrl || null } }; })
      .sort((a, b) => (b.followUp ? 0 : 1) - (a.followUp ? 0 : 1) || (b.lead.score || 0) - (a.lead.score || 0));
  }

  R('GET', '/queue', 'messages:read', async (ctx) => {
    const settings = await getSettings(ctx);
    return { items: await queueItems(ctx), caps: await capsToday(ctx, settings) };
  });

  R('POST', '/queue/prepare', 'messages', async (ctx, { body }) => prepareQueue(ctx, { limit: Math.min(100, Math.max(1, Number(body.limit) || 20)), research: body.research !== false }));

  R('POST', '/queue/:id/act', 'messages', async (ctx, { params, body }) => {
    const msg = await get(ctx, 'messages', params.id);
    const lead = await get(ctx, 'leads', msg.leadId);
    const settings = await getSettings(ctx);
    const action = body.action;
    if (action === 'skip') { msg.status = 'skipped'; await put(ctx, 'messages', msg); return { ok: true }; }
    if (action === 'later') { msg.snoozeUntil = new Date(Date.now() + DAY).toISOString(); await put(ctx, 'messages', msg); return { ok: true }; }
    if (typeof body.body === 'string' && body.body.trim()) { msg.body = clip(body.body, 20000); await put(ctx, 'messages', msg); }
    const caps = await capsToday(ctx, settings);
    const cap = caps[msg.channel];
    if (cap && cap.left === 0 && !body.force) throw new HttpError(409, `Дневной лимит канала исчерпан (${cap.cap}). Это защита аккаунта от блокировки — продолжите завтра или поменяйте лимит в Настройках.`);
    if (action === 'apply' || msg.channel === 'hh_apply') {
      need(ctx.services?.hh?.apply, 400, 'Отклик через API hh.ru не подключён: «Каналы → HeadHunter» (токен соискателя и резюме).');
      const r = await ctx.services.hh.apply(ctx, { vacancyId: lead.vacancy?.id || lead.sourceRef, resumeId: settings.hh?.resumeId, message: msg.body });
      if (r.captchaUrl) {
        lead.hh = { ...(lead.hh || {}), captchaUrl: r.captchaUrl, captchaAt: nowIso() }; await put(ctx, 'leads', lead);
        return { ok: false, captcha: r.captchaUrl, note: 'hh.ru просит капчу. Откройте ссылку, решите её и нажмите «Повторить отклик».' };
      }
      lead.hh = { ...(lead.hh || {}), negotiationId: r.negotiationId || null, captchaUrl: null, appliedAt: nowIso() };
      await put(ctx, 'leads', lead);
      msg.status = 'sent'; msg.sentAt = nowIso(); msg.providerId = r.negotiationId || null; await put(ctx, 'messages', msg);
      advance(lead, 'contacted'); lead.lastTouchAt = msg.sentAt; await put(ctx, 'leads', lead);
      await audit(ctx, 'hh.apply', { lead: lead.id });
      return { ok: true, applied: true };
    }
    const r = await handle(ctx, 'POST', `/messages/${msg.id}/send`, { manual: msg.channel !== 'email', now: true });
    return { ok: true, link: r.link, queued: r.queued, note: r.note };
  });

  // ---- hh: синхронизация переписки (ответы работодателей → «Пришёл ответ») ----
  async function syncHh(ctx) {
    if (!ctx.services?.hh?.messages) return { synced: 0, replies: 0, note: 'Синхронизация hh доступна с токеном соискателя.' };
    const leads = (await list(ctx, 'leads')).filter(l => l.hh?.negotiationId && !['won', 'lost'].includes(l.stage));
    let replies = 0;
    for (const l of leads) {
      try {
        const items = await ctx.services.hh.messages(ctx, l.hh.negotiationId);
        const since = l.hh.lastSeenAt ? new Date(l.hh.lastSeenAt).getTime() : 0;
        const fresh = items.filter(m => m.author === 'employer' && new Date(m.at).getTime() > since);
        for (const m of fresh) { await handle(ctx, 'POST', `/leads/${l.id}/reply`, { text: m.text, channel: 'hh_chat' }); replies++; }
        const lead2 = await get(ctx, 'leads', l.id);
        lead2.hh = { ...(lead2.hh || {}), lastSeenAt: items.length ? items[items.length - 1].at : lead2.hh?.lastSeenAt };
        await put(ctx, 'leads', lead2);
      } catch { /* один лид не ломает синхронизацию остальных */ }
    }
    return { synced: leads.length, replies };
  }
  R('POST', '/hh/sync', 'messages', async (ctx) => syncHh(ctx));
  R('GET', '/hh/resumes', 'settings', async (ctx) => ctx.services?.hh?.resumes ? ctx.services.hh.resumes(ctx) : []);

  // ---- плейбук по лиду: честный отклик, шаги переписки, слоты, дожим, фиксация ----
  R('GET', '/leads/:id/playbook', 'leads:read', async (ctx, { params }) => {
    const lead = await get(ctx, 'leads', params.id);
    const settings = await getSettings(ctx);
    const slots = meetingSlots({ clientTz: settings.tz?.clients, myTz: settings.tz?.mine });
    const cost = lead.inaction || vacancyCost({});
    const caseLinks = proofsFor(ctx, settings).filter(p => p.url).map(p => p.url).filter((v, i, a) => a.indexOf(v) === i);
    const painLine = `пока нет руководителя продаж, недобор около ${fmtRub(cost.lostPerMonthRub)} в месяц, а ошибка найма — ещё ≈ ${fmtRub(cost.badHireRiskRub)}`;
    return {
      letter: responseLetter({ lead, settings }),
      steps: dialogSteps({ lead, slots }),
      slots, cadence: followUpCadence({ lead, painLine, caseLinks, videoLink: settings.brand?.video || 'https://vk.ru/wall162828890_2687' }),
      flags: vacancyFlags([lead.vacancy?.description, lead.vacancy?.snippet].filter(Boolean).join(' ')).concat(lead.flags || []).filter((f, i, a) => a.findIndex(x => x.id === f.id) === i),
      record: meetingRecord(lead, slots[0]?.at), painLine,
    };
  });

  // ---- автопилот ----
  async function runAutopilot(ctx, phase = 'morning') {
    const settings = await getSettings(ctx);
    const ap = settings.autopilot || {};
    const report = { phase, at: nowIso(), steps: [] };
    if (phase === 'morning') {
      if (ctx.services?.hh?.search) {
        try {
          const found = await handle(ctx, 'POST', '/hh/search', { minScore: ap.minScore ?? settings.hh?.minScore ?? 45 });
          const pick = found.items.filter(x => !x.preview.imported && !(x.preview.stops || []).length).slice(0, ap.dailyNew ?? 20).map(x => x.raw);
          const imp = pick.length ? await handle(ctx, 'POST', '/hh/import', { items: pick }) : { created: 0 };
          report.steps.push(`hh.ru: найдено ${found.total}, новых в работу ${imp.created}`);
        } catch (e) { report.steps.push('hh.ru: ' + e.message); }
      }
      const q = await prepareQueue(ctx, { limit: ap.prepare ?? 20, research: ap.autoResearch !== false });
      report.steps.push(`Конвейер: готово ${q.created} касаний, дожимов ${q.followUps}${q.errors.length ? `, ошибок ${q.errors.length}` : ''}`);
      const sync = await syncHh(ctx); if (sync.replies) report.steps.push(`hh: новых ответов ${sync.replies}`);
    } else {
      const days = ap.noReplyDays ?? 3;
      const [leads, msgs] = await Promise.all([list(ctx, 'leads'), list(ctx, 'messages')]);
      let closed = 0;
      for (const l of leads.filter(x => x.stage === 'contacted' && !x.demo && x.lastTouchAt && Date.now() - new Date(x.lastTouchAt) > days * DAY)) {
        const outs = msgs.filter(m => m.leadId === l.id && m.direction === 'out' && m.status === 'sent');
        const hhOnly = outs.length && outs.every(m => /^hh_/.test(m.channel));
        const fuDone = outs.filter(m => m.followUp).length >= 2;
        if (outs.some(m => m.repliedAt) || !(hhOnly || fuDone)) continue;
        l.stage = 'lost'; l.lostReason = `нет ответа ${days} дн.`; (l.history ||= []).push({ at: nowIso(), stage: 'lost', auto: true });
        await put(ctx, 'leads', l); closed++;
      }
      report.steps.push(`Правило «нет ответа ${days} дня = отказ»: закрыто ${closed}`);
      const sync = await syncHh(ctx); if (sync.replies) report.steps.push(`hh: новых ответов ${sync.replies}`);
    }
    // Сводка дня — то, что приходит в Telegram утром и вечером.
    const [leads, msgs, meetings] = await Promise.all([list(ctx, 'leads'), list(ctx, 'messages'), list(ctx, 'meetings')]);
    const today = new Date().toISOString().slice(0, 10);
    const sent = msgs.filter(m => m.direction === 'out' && m.status === 'sent' && String(m.sentAt).startsWith(today)).length;
    const replies = msgs.filter(m => m.direction === 'in' && String(m.createdAt).startsWith(today)).length;
    const waiting = leads.filter(l => l.stage === 'replied' && !l.demo).length;
    const queue = msgs.filter(m => m.status === 'approved').length;
    const mtToday = meetings.filter(m => m.status === 'scheduled' && String(m.at).startsWith(today)).length;
    report.summary = phase === 'morning'
      ? `☀️ Фокус дня: в конвейере ${queue} ${plural(queue, 'касание', 'касания', 'касаний')}, ждут ответа ${waiting}, встреч сегодня ${mtToday}.`
      : `🌙 Итог дня: отправлено ${sent}, ответов ${replies}, ждут ответа ${waiting}, в конвейере на завтра ${queue}.`;
    report.summary += '\n' + report.steps.map(s => '• ' + s).join('\n');
    await put(ctx, 'runs', { id: uid('run_'), ...report });
    const s2 = await getSettings(ctx);
    await put(ctx, 'settings', { ...s2, autopilot: { ...s2.autopilot, [phase === 'morning' ? 'lastMorning' : 'lastEvening']: localDate(s2.tz?.mine) } });
    if (ctx.services?.notify) await Promise.resolve(ctx.services.notify(ctx, report.summary)).catch(() => {});
    await audit(ctx, 'autopilot.' + phase, { steps: report.steps.length });
    return report;
  }

  R('POST', '/autopilot/run', 'settings', async (ctx, { body }) => runAutopilot(ctx, body.phase === 'evening' ? 'evening' : 'morning'));
  R('GET', '/autopilot/runs', 'analytics', async (ctx) => (await list(ctx, 'runs')).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20));

  /** Вызывается сервером раз в несколько минут: запускает фазу, если наступил её час по часовому поясу владельца. */
  async function autopilotTick(ctx, now = new Date()) {
    const s = await getSettings(ctx);
    const ap = s.autopilot || {};
    if (!ap.enabled) return null;
    const tz = s.tz?.mine || 'Asia/Ho_Chi_Minh';
    const h = localHour(tz, now), d = localDate(tz, now);
    if (h >= (ap.eveningHour ?? 20) && ap.lastEvening !== d) return runAutopilot(ctx, 'evening');
    if (h >= (ap.morningHour ?? 8) && h < (ap.eveningHour ?? 20) && ap.lastMorning !== d) return runAutopilot(ctx, 'morning');
    return null;
  }

  // ---- CRM-файл агента ----
  R('POST', '/crm/import', 'leads', async (ctx, { body }) => {
    need(typeof body.csv === 'string' && body.csv.length < 5_000_000, 400, 'Вставьте содержимое CSV-файла (до 5 МБ).');
    const rows = parseCsv(body.csv);
    need(rows.length > 1, 400, 'В файле нет строк.');
    const { leads, skipped } = rowsToLeads(rows, await list(ctx, 'leads'));
    for (const l of leads) await put(ctx, 'leads', l);
    await audit(ctx, 'crm.import', { n: leads.length, skipped });
    return { created: leads.length, skipped, byStage: Object.fromEntries(STAGES.map(s => [s.id, leads.filter(l => l.stage === s.id).length])) };
  });
  R('GET', '/crm/export', 'leads:read', async (ctx) => ({ filename: `LEADMEET_CRM_лиды_HH_${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(leadsToRows(await list(ctx, 'leads'))) }));

  // ---- прогноз «Что даст 100» ----
  R('POST', '/forecast', null, async (ctx, { body }) => {
    const settings = await getSettings(ctx);
    const f = forecast({ n: Math.min(100000, Math.max(1, Number(body.n) || 100)), unit: body.unit === 'responses' ? 'responses' : 'leads', usdRate: settings.usdRate, upsellRub: Math.max(0, Number(body.upsellRub) || 0), checkOverride: Number(body.checkRub) > 0 ? Number(body.checkRub) : null });
    return { ...f, text: clientText(f, { niche: body.niche || 'вашей нише', usdRate: settings.usdRate }) };
  });

  // ---- упаковка профиля: резюме hh и Telegram ----
  R('GET', '/packaging', null, async (ctx) => {
    const settings = await getSettings(ctx);
    return packaging({ me: settings.me, proofs: proofsFor(ctx, settings), offers: settings.offers });
  });

  // ---- лёгкие счётчики для меню ----
  R('GET', '/counts', null, async (ctx) => {
    const [leads, meetings, msgs] = await Promise.all([list(ctx, 'leads'), list(ctx, 'meetings'), list(ctx, 'messages')]);
    const ws = await ctx.store.getWorkspace(ctx.ws.id);
    return { leads: leads.filter(l => !['won', 'lost'].includes(l.stage)).length, meetings: meetings.filter(m => m.status === 'scheduled').length, queue: msgs.filter(m => m.status === 'approved').length, credits: ws?.credits ?? 0 };
  });

  return { prepareQueue, runAutopilot, autopilotTick, syncHh, capsToday, stageIndex };
}
