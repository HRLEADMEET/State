// Официальный API hh.ru (https://api.hh.ru, документация: https://api.hh.ru/openapi/redoc).
// Только публичные методы: поиск вакансий, карточка вакансии, карточка работодателя.
// HH требует заголовок HH-User-Agent с названием приложения и контактом.
import { config } from '../config.js';

const BASE = 'https://api.hh.ru';

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

export function hhService(getChannelConfig) {
  const opts = async (ctx) => { const c = await getChannelConfig(ctx, 'hh'); return { userAgent: c?.userAgent, token: c?.token }; };
  let last = 0;
  const pace = async () => { const wait = Math.max(0, last + 350 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait)); last = Date.now(); };
  return {
    async search(ctx, q) { await pace(); return hhGet('/vacancies', q, await opts(ctx)); },
    async vacancy(ctx, id) { await pace(); return hhGet('/vacancies/' + encodeURIComponent(id), null, await opts(ctx)); },
    async employer(ctx, id) { await pace(); return hhGet('/employers/' + encodeURIComponent(id), null, await opts(ctx)); },
  };
}
