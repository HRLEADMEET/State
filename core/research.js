// Исследование компании по открытым данным: сайт и публичный Telegram-канал собственника.
// Здесь только разбор уже загруженного HTML (загрузку делает сервер, с таймаутом и лимитом размера).
import { stripHtml, truncate } from './util.js';

const SOCIAL = [
  ['telegram', /https?:\/\/(?:t\.me|telegram\.me)\/(?!share|joinchat|\+)([A-Za-z0-9_]{4,})/gi],
  ['vk', /https?:\/\/(?:m\.)?vk\.(?:com|ru)\/([A-Za-z0-9_.]{2,})/gi],
  ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,})/gi],
  ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/(@?[A-Za-z0-9_\-/]{2,})/gi],
  ['dzen', /https?:\/\/dzen\.ru\/([A-Za-z0-9_.\-]{2,})/gi],
  ['linkedin', /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(in|company)\/([A-Za-z0-9_\-]{2,})/gi],
  ['whatsapp', /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d{10,15})/gi],
];

export function parseSite(html = '', url = '') {
  const h = String(html);
  const meta = (name) => (h.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)`, 'i')) || h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i')) || [])[1] || '';
  const title = stripHtml((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = stripHtml(meta('description') || meta('og:description'));
  const h1 = [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => stripHtml(m[1])).filter(Boolean).slice(0, 3);
  const h2 = [...h.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => stripHtml(m[1])).filter(Boolean).slice(0, 8);
  const text = stripHtml(h);
  const emails = [...new Set((h.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).filter(e => !/\.(png|jpg|svg|webp|gif)$/i.test(e) && !/@(example\.(com|org|net)|domain\.|sentry|wixpress|email\.)/i.test(e)))].slice(0, 5);
  const phones = [...new Set((text.match(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g) || []).map(p => p.replace(/[^\d+]/g, '').replace(/^8/, '+7')))].slice(0, 3);
  const social = {};
  for (const [k, re] of SOCIAL) {
    const m = [...h.matchAll(re)].map(x => x[0]);
    if (m.length) social[k] = [...new Set(m)].slice(0, 3);
  }
  const facts = [];
  const add = (kind, t) => { if (t && !facts.some(f => f.text === t)) facts.push({ kind, text: t, source: url }); };
  const since = text.match(/(?:с|основан[а-я]*\s+в|работаем с|на рынке с)\s+(19[89]\d|20[0-2]\d)\s*(?:года|г\.?)?/i);
  if (since) add('site_since', `на рынке с ${since[1]} года`);
  const years = text.match(/(\d{1,2})\+?\s+(?:лет|года)\s+(?:на рынке|опыта|работы)/i);
  if (years) add('site_years', `${years[1]}+ лет на рынке`);
  const clients = text.match(/(более|свыше|больше)?\s*(\d[\d\s]{1,7})\+?\s*(довольных\s+)?(клиентов|проектов|компаний|пациентов|учеников|объектов)/i);
  if (clients) add('site_clients', `${(clients[1] ? clients[1].toLowerCase() + ' ' : '')}${clients[2].trim()} ${clients[4].toLowerCase()} (по данным сайта)`);
  const offices = text.match(/(\d{1,3})\s+((?:филиал|офис|магазин|клиник|точк|салон|ресторан)[а-яё]*)/i);
  if (offices) add('site_offices', `${offices[1]} ${offices[2].toLowerCase()} (по данным сайта)`);
  if (h1[0]) add('site_h1', `главный заголовок сайта: «${truncate(h1[0], 90)}»`);
  if (description) add('site_desc', `о себе: «${truncate(description, 120)}»`);
  if (/amo|bitrix|битрикс/i.test(h)) add('site_tech', 'на сайте стоит виджет CRM (amoCRM/Битрикс24)');
  if (/jivo|jivosite|livetex|talk-me|carrotquest/i.test(h)) add('site_chat', 'на сайте онлайн-чат — заявки идут в мессенджер');
  if (/mc\.yandex\.ru\/metrika|ym\(\d+/i.test(h)) add('site_metrika', 'стоит Яндекс Метрика');
  if (/vacanc|ваканси|карьер/i.test(h)) add('site_jobs', 'на сайте есть раздел вакансий');
  return { url, title, description, h1, h2, emails, phones, social, facts: facts.slice(0, 8), textSample: truncate(text, 1500) };
}

/** Публичная веб-версия канала: https://t.me/s/<name>. Возвращает последние посты. */
export function parseTelegramChannel(html = '') {
  const posts = [...String(html).matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(m => stripHtml(m[1])).filter(t => t.length > 20);
  const title = stripHtml((String(html).match(/<div class="tgme_channel_info_header_title[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
  const subs = (String(html).match(/([\d\s.,KkMm]+)\s*(?:subscribers|подписчик)/) || [])[1] || '';
  return { title, subscribers: subs.trim(), posts: posts.slice(-15) };
}
