// Уведомления в Telegram (Bot API), транскрибация аудио, курс доллара ЦБ, OAuth-провайдеры.
import { config } from '../config.js';

// ---------- Telegram bot ----------
export async function telegramSend(botToken, chatId, text) {
  if (!botToken || !chatId) return { ok: false, skipped: true };
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error('Telegram: ' + (j.description || res.status));
  return j;
}

// ---------- Transcription ----------
// openai: любой OpenAI-совместимый /audio/transcriptions (OpenAI, Groq, локальный whisper-сервер — TRANSCRIBE_URL)
// deepgram: https://api.deepgram.com/v1/listen
export async function transcribe({ provider, key, url }, buffer, mime = 'audio/mpeg', filename = 'call.mp3') {
  provider = provider || config.transcribe.provider; key = key || config.transcribe.key; url = url || config.transcribe.url;
  if (!provider || !key) throw new Error('Транскрибация не настроена: «Каналы → Записи звонков» (провайдер и ключ) или загрузите текст расшифровки.');
  if (provider === 'deepgram') {
    const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=ru&diarize=true&punctuate=true&utterances=true', { method: 'POST', headers: { Authorization: 'Token ' + key, 'Content-Type': mime }, body: buffer });
    if (!res.ok) throw new Error('Deepgram: HTTP ' + res.status);
    const j = await res.json();
    const utt = j.results?.utterances || [];
    if (utt.length) return utt.map(u => `Спикер ${u.speaker + 1}: ${u.transcript}`).join('\n');
    return j.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }
  const endpoint = (url || 'https://api.openai.com/v1') + '/audio/transcriptions';
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mime }), filename);
  fd.append('model', process.env.TRANSCRIBE_MODEL || 'whisper-1');
  fd.append('language', 'ru');
  const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
  if (!res.ok) throw new Error('Транскрибация: HTTP ' + res.status);
  const j = await res.json();
  return j.text || '';
}

// ---------- FX ----------
let fxCache = { at: 0, rate: 92 };
export async function usdRate() {
  if (Date.now() - fxCache.at < 6 * 3600_000) return fxCache.rate;
  try {
    const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { signal: AbortSignal.timeout(5000) });
    const j = await res.json();
    if (j?.Valute?.USD?.Value) fxCache = { at: Date.now(), rate: Math.round(j.Valute.USD.Value * 100) / 100 };
  } catch { fxCache.at = Date.now(); /* оставляем последний курс */ }
  return fxCache.rate;
}

// ---------- OAuth 2.0 (Google, Яндекс ID, VK ID) ----------
export const OAUTH = {
  google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile',
    profile: async (t) => { const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } }); const j = await r.json(); return { email: j.email, name: j.name, verified: j.email_verified }; } },
  yandex: { auth: 'https://oauth.yandex.ru/authorize', token: 'https://oauth.yandex.ru/token', scope: 'login:email login:info',
    profile: async (t) => { const r = await fetch('https://login.yandex.ru/info?format=json', { headers: { Authorization: 'OAuth ' + t.access_token } }); const j = await r.json(); return { email: j.default_email, name: j.real_name || j.display_name, verified: true }; } },
  vk: { auth: 'https://id.vk.com/authorize', token: 'https://id.vk.com/oauth2/auth', scope: 'email', pkce: true,
    profile: async (t, cfg) => { const r = await fetch('https://id.vk.com/oauth2/user_info', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cfg.id, access_token: t.access_token }) }); const j = await r.json(); return { email: j.user?.email, name: [j.user?.first_name, j.user?.last_name].filter(Boolean).join(' '), verified: !!j.user?.email }; } },
};

export function oauthEnabled() {
  return Object.fromEntries(Object.entries(config.oauth).map(([k, v]) => [k, !!(v.id && v.secret)]));
}

// ---------- mymeet.ai (запись и расшифровка встреч Zoom / Телемост / МТС Линк) ----------
// REST API с ключом в заголовке X-API-KEY (mymeet.ai → Настройки → API). Формат выгрузки задаётся MYMEET_FORMAT (по умолчанию txt).
export function mymeetService(getChannelConfig) {
  const BASE = (process.env.MYMEET_API_BASE || 'https://backend.mymeet.ai').replace(/\/$/, '');
  async function key(ctx) { const c = await getChannelConfig(ctx, 'recorder'); return c?.provider === 'mymeet' && c?.key ? c.key : (process.env.MYMEET_API_KEY || ''); }
  async function req(ctx, method, path, body) {
    const k = await key(ctx);
    if (!k) throw new Error('mymeet.ai не подключён: «Каналы → Записи звонков», провайдер mymeet и API-ключ.');
    const res = await fetch(BASE + path, { method, headers: { 'X-API-KEY': k, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('mymeet.ai: HTTP ' + res.status);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  }
  return {
    available: async (ctx) => !!(await key(ctx)),
    record: (ctx, { link, title }) => req(ctx, 'POST', '/api/record-meeting', { link, title, template: 'summary' }),
    meetings: (ctx) => req(ctx, 'GET', '/api/workspaces/active/all-meetings?page=1&per_page=20'),
    transcript: (ctx, meetingId) => req(ctx, 'GET', '/api/storage/download?meeting_id=' + encodeURIComponent(meetingId) + '&format=' + encodeURIComponent(process.env.MYMEET_FORMAT || 'txt')),
  };
}
