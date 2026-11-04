// Общее состояние клиента и навигация.
import { toast, setUsd } from './ui.js';

export const S = {
  api: null,          // { mode, call(method, path, body), auth, uploadAudio }
  boot: null,         // ответ /bootstrap
  view: 'dashboard',
  param: '',
  render: null,       // функция перерисовки текущего экрана
  composer: {},       // черновики писем по лиду (не теряются при перерисовке)
};

export const call = async (method, path, body) => {
  try { return await S.api.call(method, path, body); }
  catch (e) {
    if (e.status === 401) { location.hash = ''; window.dispatchEvent(new Event('leadmeet:logout')); }
    throw e;
  }
};

/** Обёртка для действий из интерфейса: показывает ошибку тостом. */
export async function act(fn, okText) {
  try { const r = await fn(); if (okText) toast(okText); return r; }
  catch (e) { toast(e.message || 'Ошибка', 'bad'); return undefined; }
}

export async function refreshBoot() {
  S.boot = await call('GET', '/bootstrap');
  setUsd(S.boot.settings?.usdRate);
  return S.boot;
}

export const leadHash = (id) => '#lead-' + String(id).replace('_', '-');
export const scriptHash = (id) => '#script-' + String(id).replace('_', '-');
export const idFromHash = (s) => String(s).replace('-', '_');

export function go(hash) { if (location.hash === hash) S.render?.(); else location.hash = hash; }

export const stageName = (id) => S.boot?.catalog.stages.find(s => s.id === id)?.name || id;
export const hookName = (id) => S.boot?.catalog.hooks.find(h => h.id === id)?.name || id;
export const offers = () => S.boot?.settings.offers || [];
export const offerName = (id) => offers().find(o => o.id === id)?.name || id;
export const canDo = (perm) => {
  const r = S.boot?.catalog.roles[S.boot.role];
  if (!r) return false;
  if (r.can.includes('*') || r.can.includes(perm)) return true;
  const [area, action] = perm.split(':');
  return r.can.includes(area) && (!action || action === 'read');
};
