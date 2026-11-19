// «Харви: почта» — холодные письма по открытым данным бизнеса. Механика по мотивам открытого проекта Harvey (MIT,
// github.com/ethanplusai/harvey), код свой: сигналы предлагает система, подтверждает человек → когорта = выборка по
// подтверждённым сигналам → проверка адреса → последовательность из 2 писем → жёсткий фильтр перед отправкой →
// исходящие на одобрение → отправка в рабочее время получателя → разбор ответов.
import { addressName } from './util.js';
import { PROOFS } from './catalog.js';

export const SIGNAL_CATALOG = [
  { code: 'HIRING_SALES', label: 'Нанимают в продажи', why: 'Открыта вакансия РОПа или менеджера — рост упёрся в отдел', test: (l) => !!l.vacancy?.title || (l.facts || []).some(f => /ваканси/i.test(f.text)) },
  { code: 'NO_TEAM_PAGE_OWNER', label: 'Собственник на виду', why: 'Имя собственника есть на сайте или в ЕГРЮЛ — письмо лично ему', test: (l) => !!l.owner?.name },
  { code: 'CHAT_NO_CRM', label: 'Чат на сайте, CRM не видно', why: 'Заявки идут в мессенджер и теряются', test: (l) => (l.facts || []).some(f => f.kind === 'site_chat') && !(l.facts || []).some(f => f.kind === 'site_tech') },
  { code: 'MULTI_BRANCH', label: 'Несколько филиалов', why: 'Есть масштаб и бюджет на систему', test: (l) => (l.facts || []).some(f => /филиал/i.test(f.text)) },
  { code: 'LOW_RATING', label: 'Рейтинг на картах ниже 4,5', why: 'Сервис и продажи проседают — есть боль', test: (l) => (l.facts || []).some(f => { const m = f.text.match(/рейтинг на картах ([\d.]+)/); return m && +m[1] < 4.5; }) },
  { code: 'YOUNG_COMPANY', label: 'Компании до 5 лет', why: 'Строят отдел впервые', test: (l) => { const y = l.egrul?.registered?.slice(0, 4); return y && new Date().getFullYear() - +y <= 5; } },
  { code: 'OWNER_POSTS', label: 'Собственник ведёт канал', why: 'Можно писать на его языке, есть повод', test: (l) => (l.owner?.posts || []).length > 0 },
];

export function detectSignals(lead) { return SIGNAL_CATALOG.filter(s => { try { return s.test(lead); } catch { return false; } }).map(s => s.code); }

/** Когорта: лиды с адресом, без отписки и без касаний, у которых есть хотя бы один подтверждённый сигнал. */
export function buildCohort(leads, confirmed = [], { touched = new Set(), limit = 50 } = {}) {
  const want = new Set(confirmed);
  return leads.filter(l => !l.optOut && !l.demo && !touched.has(l.id) && emailOf(l) && ['new', 'researched'].includes(l.stage))
    .map(l => ({ lead: l, signals: detectSignals(l).filter(c => want.has(c)) }))
    .filter(x => x.signals.length).sort((a, b) => b.signals.length - a.signals.length || (b.lead.score || 0) - (a.lead.score || 0)).slice(0, limit);
}

export const emailOf = (l) => l.contacts?.ownerEmail || l.contacts?.emails?.[0] || '';

/** Варианты личного адреса по имени и домену (проверяйте ответом сервера, не рассылкой наугад). */
export function emailGuesses(fullName = '', domain = '') {
  const tr = (s) => s.toLowerCase().replace(/[а-яё]/g, ch => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' })[ch] ?? ch);
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean).map(tr);
  const d = String(domain).replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!parts.length || !d) return [];
  const [a, b] = parts.length >= 2 && /(ov|ev|in|sky|aya|ova|eva|ina)$/.test(parts[0]) ? [parts[1], parts[0]] : [parts[0], parts[1] || ''];
  return [...new Set([b && `${a}.${b}`, a, b && `${a[0]}.${b}`, b && `${a}${b}`, b && `${b}`].filter(Boolean).map(x => `${x}@${d}`))];
}

const SIGNAL_OPENERS = {
  HIRING_SALES: (l) => `увидел, что ${l.company} ищет ${l.vacancy?.title ? 'человека на позицию «' + l.vacancy.title + '»' : 'людей в продажи'}`,
  NO_TEAM_PAGE_OWNER: (l) => `пишу вам лично как собственнику ${l.company}`,
  CHAT_NO_CRM: (l) => `заметил на сайте ${l.company} онлайн-чат — заявки идут в мессенджер`,
  MULTI_BRANCH: (l) => `у ${l.company} уже несколько филиалов`,
  LOW_RATING: (l) => `посмотрел отзывы о ${l.company} на картах`,
  YOUNG_COMPANY: (l) => `${l.company} растёт всего несколько лет`,
  OWNER_POSTS: (l) => `читаю ваш канал`,
};

/** Последовательность из двух писем: короткое первое и мягкое напоминание на 3-й рабочий день. */
export function sequence({ lead, signals = [], me = {}, proofs = PROOFS }) {
  const name = addressName(lead.owner?.name || '', true);
  const hi = name ? `${name}, добрый день.` : 'Добрый день.';
  const opener = (SIGNAL_OPENERS[signals[0]] || SIGNAL_OPENERS.NO_TEAM_PAGE_OWNER)(lead);
  const proof = (proofs || []).find(p => p.isCase) || null;
  const sign = `${me.name || 'Влад Лев'}${me.telegram ? '\nTelegram: ' + me.telegram : ''}`;
  const optout = 'Если не актуально — ответьте «нет», больше не напишу.';
  const e1 = {
    subject: `вопрос про продажи ${lead.company}`.slice(0, 80),
    body: `${hi}\n\nКоротко: ${opener}. Обычно в такой момент заявки есть, а продажи держатся на собственнике.\n\n${proof ? `Мы с этим работаем: ${proof.text}. ` : ''}Могу за 20 минут показать на ваших цифрах, где теряются сделки. Удобно на этой неделе?\n\n${sign}\n\n${optout}`,
    step: 1, delayDays: 0,
  };
  const e2 = {
    subject: `Re: ${e1.subject}`,
    body: `${hi}\n\nПоднимаю письмо, вдруг утонуло. Если сейчас не время — просто напишите, когда вернуться к теме.\n\n${sign}\n\n${optout}`,
    step: 2, delayDays: 3,
  };
  return [e1, e2];
}

const BANNED = ['уникальное предложение', 'только сегодня', 'гарантия 100', 'кликните', 'жми', 'выгодное предложение', 'надеюсь, это письмо', 'как ии', 'как языковая модель', 'act now', 'click here', 'limited time', 'guaranteed', 'i hope this finds you well'];

/** Жёсткий фильтр перед отправкой: никакая генерация не уйдёт, если нарушено правило. */
export function preSendGate({ to, subject = '', body = '', lead = {} }) {
  const reasons = [];
  const low = (subject + ' ' + body).toLowerCase();
  if (!/^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}$/.test(to || '')) reasons.push('Некорректный адрес получателя');
  if (lead.emailCheck && lead.emailCheck !== 'ok') reasons.push('Домен получателя не принимает почту (нет MX)');
  if (lead.optOut) reasons.push('Получатель отписался');
  if (subject.length > 90) reasons.push('Тема длиннее 90 символов');
  if (body.split(/\s+/).filter(Boolean).length > 220) reasons.push('Письмо длиннее 220 слов');
  if ((body.match(/https?:\/\//g) || []).length > 1) reasons.push('Больше одной ссылки');
  if (/\{\{?\s*\w+\s*\}?\}/.test(subject + body)) reasons.push('Незаполненная переменная');
  for (const b of BANNED) if (low.includes(b)) reasons.push(`Запрещённая фраза: «${b}»`);
  if (!/не напишу|отпис/i.test(body)) reasons.push('Нет фразы-отписки');
  return { ok: reasons.length === 0, reasons };
}

const CITY_TZ = [
  [/москв|санкт|петербург|казан|нижн|ростов|воронеж|краснодар|самар|волгоград|пермь|ярослав|тула/i, 'Europe/Moscow'], [/екатеринбург|челябинск|тюмень|уфа/i, 'Asia/Yekaterinburg'],
  [/новосибирск|омск|томск/i, 'Asia/Novosibirsk'], [/красноярск/i, 'Asia/Krasnoyarsk'], [/иркутск/i, 'Asia/Irkutsk'], [/владивосток|хабаровск/i, 'Asia/Vladivostok'],
  [/алматы|астана|шымкент|казахстан/i, 'Asia/Almaty'], [/ханой|хошимин|нячанг|дананг|вьетнам|hanoi|ho chi minh|nha trang|da nang/i, 'Asia/Ho_Chi_Minh'],
  [/пекин|шанхай|гуанчжоу|шэньчжэнь|китай|beijing|shanghai|guangzhou|shenzhen/i, 'Asia/Shanghai'], [/дубай|абу-даби|dubai|оаэ/i, 'Asia/Dubai'],
  [/стамбул|анкара|анталья|istanbul|турци/i, 'Europe/Istanbul'], [/ташкент/i, 'Asia/Tashkent'], [/бишкек/i, 'Asia/Bishkek'], [/минск/i, 'Europe/Minsk'], [/тбилиси/i, 'Asia/Tbilisi'], [/ереван/i, 'Asia/Yerevan'],
];
export const tzForCity = (city = '') => (CITY_TZ.find(([re]) => re.test(city)) || [null, 'Europe/Moscow'])[1];

/** Ближайшее рабочее время получателя (будни 9:00–17:00 по его поясу). */
export function nextSendTime(after = new Date(), tz = 'Europe/Moscow', { from = 9, to = 17 } = {}) {
  const t = new Date(after.getTime());
  for (let i = 0; i < 24 * 8; i++) {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(t);
    const h = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(t);
    if (!['Sat', 'Sun'].includes(wd) && h >= from && h < to) return t;
    t.setTime(t.getTime() + 3600_000); t.setUTCMinutes(i ? 7 : t.getUTCMinutes());
  }
  return t;
}
