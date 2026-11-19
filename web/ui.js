// UI-примитивы: экранирование, иконки, тосты, модалки, подсказки, форматирование денег.
import { escapeHtml, fmtRub, fmtUsd } from '../core/util.js';
import { rateOf, fmtCur } from '../core/currency.js';

export const esc = escapeHtml;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let USD = 92;
let SEC = { code: 'USD', rate: 92 }; // вторая валюта в скобках: по умолчанию доллар, можно тенге, донг, юань…
export function setUsd(r) { USD = Number(r) || 92; if (SEC.code === 'USD') SEC.rate = USD; }
export function setSecond(code = 'USD', rates = {}) { SEC = { code: code || 'USD', rate: code === 'USD' ? (Number(rates.USD) || USD) : rateOf(code, rates) }; }
const second = (rub) => SEC.code === 'USD' ? fmtUsd((Number(rub) || 0) / SEC.rate) : fmtCur((Number(rub) || 0) / SEC.rate, SEC.code);
/** Деньги всегда парой: «250 000 ₽ ($2 717)» или во второй валюте рынка. */
export function money(rub, { usd = true } = {}) {
  if (rub === null || rub === undefined || Number.isNaN(Number(rub))) return '—';
  return `<span class="money">${fmtRub(rub)}${usd ? ` <span class="mute">(${second(rub)})</span>` : ''}</span>`;
}
export const moneyText = (rub) => `${fmtRub(rub)} (${second(rub)})`;
export const usd = (rub) => second(rub);

const P = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3"/><path d="M7 15h10"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0V7zM12 17v5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  cat: '<path d="M5 20c0-6 2-9 7-9s7 3 7 9"/><path d="M7 12L5 4l5 4M17 12l2-8-5 4"/><circle cx="10" cy="15" r=".6"/><circle cx="14" cy="15" r=".6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5M12 17h0"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4"/>',
  moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
};
export const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

export function toast(text, kind = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = text; box.append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6500 : 3800);
}

export function modal(html, { wide = false, onMount } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(ov);
  const m = ov.firstElementChild;
  const f = m.querySelector('input, textarea, select, button'); if (f) f.focus();
  if (onMount) onMount(m, close);
  return { el: m, close };
}

/** Модалка-подтверждение (confirm() в артефактах не работает). */
export function ask(text, { ok = 'Да', cancel = 'Отмена', danger = false } = {}) {
  return new Promise((resolve) => {
    modal(`<h3>${esc(text)}</h3><div class="row" style="justify-content:flex-end"><button class="btn" data-close data-v="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div>`, {
      onMount(m, close) { m.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { close(); resolve(b.dataset.v === '1'); } }); },
    });
  });
}

/** Кнопка-подсказка «?» рядом с элементом управления. */
export const hint = (text) => `<button type="button" class="hint-btn" data-hint="${esc(text)}" aria-label="Подсказка">?</button>`;

export function bindHints(root = document) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.hint-btn');
    $$('.pop').forEach(p => p.remove());
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const pop = document.createElement('div'); pop.className = 'pop'; pop.textContent = b.dataset.hint;
    document.body.append(pop);
    const r = b.getBoundingClientRect();
    const x = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 16);
    pop.style.left = Math.max(16, x) + 'px'; pop.style.top = (window.scrollY + r.bottom + 8) + 'px';
  }, true);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); return true; }
  catch { toast('Не удалось скопировать автоматически — выделите текст вручную.', 'bad'); return false; }
}

export function fmtDate(iso, withTime = true) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + (withTime ? ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');
}
export function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return m <= 1 ? 'только что' : `${m} мин назад`;
  const h = Math.round(m / 60); if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24); return `${d} дн. назад`;
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'number') out[el.name] = el.value === '' ? '' : Number(el.value);
    else out[el.name] = el.value;
  }
  return out;
}

export const scoreRing = (v, lg = false) => {
  const c = v >= 75 ? 'var(--ok)' : v >= 50 ? 'var(--brand)' : 'var(--warn)';
  return `<span class="score ${lg ? 'lg' : ''}" style="--v:${Math.round(v)};--c:${c}"><span>${Math.round(v)}</span></span>`;
};

export const pct = (x) => `${(Math.round(x * 10) / 10).toLocaleString('ru-RU')}%`;
