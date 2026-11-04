// Shared helpers. Pure JS: runs in Node (server) and in the browser (demo build).

export function uid(prefix = '') {
  const rnd = (globalThis.crypto && globalThis.crypto.getRandomValues)
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 14)
    : Math.random().toString(36).slice(2, 16);
  return prefix + Date.now().toString(36) + rnd;
}

export const nowIso = () => new Date().toISOString();

export function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function round(n, d = 0) { const k = 10 ** d; return Math.round((Number(n) || 0) * k) / k; }

export function fmtRub(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
}

export function fmtUsd(n) {
  const v = Math.round(Number(n) || 0);
  return '$' + v.toLocaleString('en-US');
}

/** "250 000 ₽ ($2 717)" — рубли и в скобках доллары, как просили. */
export function fmtMoney(rub, usdRate) {
  const rate = Number(usdRate) || 92;
  return `${fmtRub(rub)} (${fmtUsd((Number(rub) || 0) / rate)})`;
}

export function pct(a, b, d = 1) { return b ? round((a / b) * 100, d) : 0; }

export function pick(arr, seed) {
  if (!arr || !arr.length) return undefined;
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : Math.abs(hash(String(seed))) % arr.length;
  return arr[i];
}

/** Deterministic 32-bit string hash (FNV-1a) — for stable variant choice, not security. */
export function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h | 0;
}

export function stripHtml(s = '') {
  return String(s).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&laquo;|&raquo;/g, '"')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function firstName(full = '') { return String(full).trim().split(/\s+/)[0] || ''; }

/** Возвращает имя и отчество ("Дмитрий Сергеевич") из "Иванов Дмитрий Сергеевич" или "Дмитрий Иванов". */
export function addressName(full = '', formal = true) {
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const patr = parts.find(p => /(вич|вна|ична|кызы|оглы)$/i.test(p));
  if (patr) {
    const i = parts.indexOf(patr);
    const name = parts[i - 1] || parts[0];
    return formal ? `${name} ${patr}` : name;
  }
  // "Фамилия Имя" vs "Имя Фамилия": Russian surnames usually end with -ов/-ев/-ин/-ский/-ая
  if (parts.length >= 2 && /(ов|ев|ин|ын|ский|цкий|ова|ева|ина|ская|ко|ук|юк)$/i.test(parts[0])) return parts[1];
  return parts[0];
}

export function daysBetween(a, b = new Date()) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

export function words(text = '') {
  return String(text).toLowerCase().match(/[a-zа-яё0-9-]+/gi) || [];
}

export function sentences(text = '') {
  return String(text).split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 1);
}

export function truncate(s = '', n = 120) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

export function groupBy(arr, fn) {
  const m = {};
  for (const x of arr) { const k = typeof fn === 'function' ? fn(x) : x[fn]; (m[k] ||= []).push(x); }
  return m;
}

export function sum(arr, fn = x => x) { return arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0); }

export function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b === undefined ? a : b;
  const out = { ...(a || {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
}

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

export function need(cond, status, msg) { if (!cond) throw new HttpError(status, msg); }
