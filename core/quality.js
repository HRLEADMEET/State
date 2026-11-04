// Качество касания (доставляемость + человечность) и классификация ответов.
// Задача — чтобы письмо было действительно личным и полезным; это единственный устойчивый
// способ не попадать в спам. Никаких техник обхода фильтров здесь нет и не будет.

import { hhSafetyCheck as hhIssues } from './hhPlaybook.js';

/** Оценщик: каждое заметное число в тексте должно встречаться в фактах лида, кейсах или офферах. */
export function unverifiedNumbers(body = '', lead = {}, sources = '') {
  const norm = (x) => String(x).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  const corpus = norm([sources, JSON.stringify(lead.facts || []), JSON.stringify(lead.inaction || {}), JSON.stringify(lead.vacancy || {}), JSON.stringify(lead.hypotheses || [])].join(' '));
  const out = [];
  const re = /(\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?)\s*(%|₽|руб|тыс|млн|менеджер|лид|клиент|отклик|сделк|дн|человек|филиал)?/gi;
  for (const m of String(body).matchAll(re)) {
    const raw = m[1].trim(); const num = norm(raw);
    if (!num || Number(num) < 10) continue;
    const after = String(body).slice(m.index + m[0].length, m.index + m[0].length + 8).toLowerCase();
    if (/^\s*(мин|минут|час|:)/.test(after) || /:\d/.test(String(body).slice(m.index - 3, m.index))) continue; // длительность и время встречи
    if (/^(19|20)\d\d$/.test(num) && !m[2]) continue; // годы
    if (!corpus.includes(num) && !corpus.includes(String(Math.round(Number(num))))) out.push(raw + (m[2] ? ' ' + m[2] : ''));
  }
  return [...new Set(out)].slice(0, 5);
}

const SPAMMY = ['бесплатно!!!', 'гарантия 100', 'только сегодня', 'срочно', 'акция', 'скидка', 'выгодное предложение', 'заработок', 'жми', 'кликни', 'уникальное предложение', 'лучшая цена', 'успей', 'миллион за', '100%'];
const TEMPLATE_SMELL = ['уважаемый партнёр', 'уважаемый клиент', 'предлагаем вам', 'наша компания', 'мы являемся', 'коммерческое предложение', 'рады предложить', 'лидер рынка', 'индивидуальный подход', 'широкий спектр'];

export function checkMessage({ subject = '', body = '', channel = 'email', lead = {}, sources = '' } = {}) {
  const issues = []; let score = 100;
  const text = (subject + '\n' + body);
  const low = text.toLowerCase();
  const words = body.split(/\s+/).filter(Boolean).length;
  const links = (body.match(/https?:\/\//g) || []).length;
  const capsWords = (text.match(/\b[A-ZА-ЯЁ]{4,}\b/g) || []).filter(w => !['LEADMEET', 'CRM', 'KPI', 'ROI', 'SaaS'].includes(w)).length;
  const excl = (text.match(/!/g) || []).length;

  const add = (pen, level, msg) => { score -= pen; issues.push({ level, msg }); };
  if (channel === 'email' && !subject.trim()) add(15, 'error', 'Нет темы письма.');
  if (channel === 'email' && subject.length > 60) add(5, 'warn', 'Тема длиннее 60 символов — на телефоне обрежется.');
  if (words > 160) add(15, 'warn', `Длинно: ${words} слов. Собственник дочитывает 60–120.`);
  if (words < 25) add(10, 'warn', 'Слишком коротко — не видно, почему пишете именно ему.');
  if (links > 1) add(15, 'warn', 'Больше одной ссылки в первом письме — хуже доставляемость.');
  if (capsWords > 1) add(8, 'warn', 'Слова КАПСОМ выглядят как реклама.');
  if (excl > 2) add(6, 'warn', 'Много восклицаний.');
  for (const w of SPAMMY) if (low.includes(w)) add(10, 'warn', `Рекламное слово: «${w}».`);
  for (const w of TEMPLATE_SMELL) if (low.includes(w)) add(8, 'warn', `Шаблонный оборот: «${w}» — так пишут рассылки.`);
  const personal = [lead.company, lead.owner?.name?.split(' ')[0], lead.vacancy?.title].filter(Boolean).filter(x => low.includes(String(x).toLowerCase().slice(0, 12)));
  if (!personal.length) add(20, 'error', 'Нет ни одной личной детали (имя, компания, вакансия, факт).');
  if (!/\?/.test(body)) add(8, 'warn', 'Нет вопроса в конце — человеку не на что ответить.');
  if ((body.match(/\?/g) || []).length > 3) add(5, 'warn', 'Слишком много вопросов сразу.');
  if (channel === 'email' && !/не напишу|отпис|неактуальн/i.test(body)) add(10, 'warn', 'Нет фразы-отписки — добавьте «если неактуально — ответьте „нет“».');
  if (/\{\w+\}/.test(text)) add(30, 'error', 'Остались незаполненные переменные {…}.');
  if (lead.optOut) add(100, 'error', 'Контакт просил больше не писать.');
  if (/₸|тенге/i.test(text) && /₽|руб/i.test(text)) add(10, 'warn', 'В тексте и тенге, и рубли — проверьте валюту и арифметику.');
  if (channel === 'hh_chat') for (const i of hhIssues(body)) add(25, i.level, i.msg);
  for (const n of unverifiedNumbers(body, lead, sources)) add(6, 'warn', `Цифра «${n}» не найдена в карточке, кейсах и офферах — проверьте источник.`);
  return { score: Math.max(0, score), issues, words, ok: score >= 70 && !issues.some(i => i.level === 'error') };
}

const RULES = [
  ['unsubscribe', /отпиш|не пиши|не беспоко|удалите|спам|отстань|больше не/],
  ['negative', /не интерес|неинтерес|не актуал|неактуал|нет,? спасибо|не нужно|не надо|не требуется|откаж/],
  ['have_contractor', /уже есть|уже работаем|свой (роп|отдел|подрядчик)|подрядчик есть|справляемся/],
  ['later', /позже|не сейчас|через (месяц|неделю|квартал)|после (праздник|нового года)|вернёмся|напишите (позже|через)/],
  ['price', /сколько стоит|цена|стоимост|прайс|бюджет|по деньгам/],
  ['positive', /давайте|интересно|актуально|созвон|когда удобно|можно (завтра|сегодня|в)|готов|да,|звоните|набер|пишите в|расскажите/],
  ['question', /\?/],
];

export function classifyReply(text = '') {
  const t = String(text).toLowerCase();
  for (const [cls, re] of RULES) if (re.test(t)) return cls;
  return 'question';
}

/** Если в ответе предложено время — вытаскиваем его. */
export function extractTime(text = '') {
  const m = String(text).match(/(сегодня|завтра|послезавтра|в понедельник|во вторник|в среду|в четверг|в пятницу)?\s*(?:в|к)?\s*(\d{1,2})[:.](\d{2})/i);
  return m ? { day: m[1] || '', hh: +m[2], mm: +m[3] } : null;
}
