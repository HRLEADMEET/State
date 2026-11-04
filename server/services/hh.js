// Официальный API hh.ru (https://api.hh.ru, документация: https://api.hh.ru/openapi/redoc).
// Только публичные методы: поиск вакансий, карточка вакансии, карточка работодателя.
// HH требует заголовок HH-User-Agent с названием приложения и контактом.
import { config } from '../config.js';

const BASE = (process.env.HH_API_BASE || 'https://api.hh.ru').replace(/\/$/, '');

async function hhGet(path, params, { userAgent, token } = {}) {
  const ua = userAgent || config.hhUserAgent;
  if (!ua) throw new Error('Укажите HH-User-Agent в разделе «Каналы → HeadHunter» (например: LeadmeetOS/1.0 (you@domain.ru)).');
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v !== '' && v != null && v !== false) qs.append(k, String(v));
  const url = BASE + path + (qs.toString() ? '?' + qs : '');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), config.fetchTimeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'HH-User-Agent': ua, 'User-Agent': ua, ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    if (res.status === 429) throw new Error('hh.ru ограничил частоту запросов — повторите через минуту.');
    if (res.status === 403) throw new Error('hh.ru отклонил запрос (403). Проверьте HH-User-Agent или подключите OAuth-токен приложения.');
    if (!res.ok) throw new Error('hh.ru: HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function hhPost(path, form, { userAgent, token }) {
  const ua = userAgent || config.hhUserAgent;
  if (!ua) throw new Error('Укажите HH-User-Agent в разделе «Каналы → HeadHunter».');
  if (!token) throw new Error('Для откликов нужен OAuth-токен соискателя (раздел «Каналы → HeadHunter»).');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), config.fetchTimeoutMs);
  try {
    const res = await fetch(BASE + path, { method: 'POST', signal: ctl.signal, headers: { 'HH-User-Agent': ua, 'User-Agent': ua, Authorization: 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json, location: res.headers.get('location') || '' };
  } finally { clearTimeout(t); }
}

/** Ищет в ответе hh.ru требование капчи и ссылку на неё (человек решает капчу сам). */
export function captchaFrom(json) {
  const errs = json?.errors || [];
  const e = errs.find(x => /captcha/i.test(String(x.type) + String(x.value)));
  if (!e) return null;
  return e.captcha_url_with_backurl || e.captcha_url || e.fallback_url || 'https://hh.ru/account/captcha';
}

export function hhService(getChannelConfig) {
  const opts = async (ctx) => { const c = await getChannelConfig(ctx, 'hh'); return { userAgent: c?.userAgent, token: c?.token, applicantToken: c?.applicantToken, resumeId: c?.resumeId }; };
  let last = 0;
  const pace = async () => { const wait = Math.max(0, last + 350 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); last = Date.now(); };
  return {
    async search(ctx, q) { await pace(); return hhGet('/vacancies', q, await opts(ctx)); },
    async vacancy(ctx, id) { await pace(); return hhGet('/vacancies/' + encodeURIComponent(id), null, await opts(ctx)); },
    async employer(ctx, id) { await pace(); return hhGet('/employers/' + encodeURIComponent(id), null, await opts(ctx)); },
    // ---- соискатель: отклик, переписка, резюме (официальные методы /negotiations и /resumes/mine) ----
    async apply(ctx, { vacancyId, resumeId, message }) {
      await pace();
      const o = await opts(ctx);
      const rid = resumeId || o.resumeId;
      if (!vacancyId || !rid) throw new Error('Нужны вакансия и резюме (ID резюме — в «Каналы → HeadHunter»).');
      const r = await hhPost('/negotiations', { vacancy_id: String(vacancyId), resume_id: String(rid), message: String(message || '').slice(0, 4000) }, { userAgent: o.userAgent, token: o.applicantToken });
      const captchaUrl = captchaFrom(r.json);
      if (captchaUrl) return { captchaUrl };
      if (r.status === 201 || r.status === 200) return { negotiationId: (r.location.match(/negotiations\/(\w+)/) || [])[1] || r.json?.id || null };
      const err = (r.json?.errors || []).map(e => e.value || e.type).join(', ');
      if (/limit_exceeded/.test(err)) throw new Error('hh.ru: дневной лимит откликов исчерпан.');
      if (/already_applied/.test(err)) throw new Error('hh.ru: по этой вакансии уже есть отклик.');
      throw new Error('hh.ru отклик: HTTP ' + r.status + (err ? ' (' + err + ')' : ''));
    },
    async messages(ctx, negotiationId) {
      await pace();
      const o = await opts(ctx);
      const j = await hhGet('/negotiations/' + encodeURIComponent(negotiationId) + '/messages', null, { userAgent: o.userAgent, token: o.applicantToken });
      return (j.items || []).map(m => ({ author: m.author?.participant_type === 'employer' ? 'employer' : 'applicant', at: m.created_at, text: m.text || '' }));
    },
    async resumes(ctx) {
      const o = await opts(ctx);
      const j = await hhGet('/resumes/mine', null, { userAgent: o.userAgent, token: o.applicantToken });
      return (j.items || []).map(r => ({ id: r.id, title: r.title }));
    },
  };
}
