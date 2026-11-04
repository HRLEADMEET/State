// Загрузка публичных страниц: сайт компании, публичная веб-версия Telegram-канала.
// Защита: только http/https, запрет внутренних адресов (SSRF), таймаут, лимит размера, свой User-Agent.
import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd]/i, /^fe80/i];

export async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { throw new Error('Некорректный адрес'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Разрешены только http/https');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('Внутренние адреса запрещены');
  const addrs = net.isIP(u.hostname) ? [{ address: u.hostname }] : await dns.lookup(u.hostname, { all: true });
  for (const a of addrs) if (PRIVATE.some(re => re.test(a.address))) throw new Error('Внутренние адреса запрещены');
  return u;
}

export async function fetchText(raw, { maxBytes = 1_500_000, timeoutMs = config.fetchTimeoutMs, headers = {} } = {}) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadmeetOS/0.8; +research of public pages)', 'Accept-Language': 'ru,en;q=0.8', ...headers } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = await assertPublicUrl(new URL(res.headers.get('location'), url).href); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader(); const chunks = []; let n = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > maxBytes) { ctl.abort(); break; } chunks.push(value); }
      return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
    } finally { clearTimeout(t); }
  }
  throw new Error('Слишком много перенаправлений');
}

export const webService = {
  fetch: (url) => fetchText(url),
  telegram: (name) => fetchText('https://t.me/s/' + encodeURIComponent(String(name).replace(/^@/, ''))),
};
