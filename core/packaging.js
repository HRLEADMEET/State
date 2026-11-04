// Упаковка: резюме hh как лид-магнит (правила из кейса HH-партизан), профиль и закреп в Telegram.
// Всё строится только из ваших данных: имя, позиционирование, кейсы, офферы. Ничего не выдумывается.
import { fmtRub } from './util.js';

const cap = (t = '') => t ? t[0].toUpperCase() + t.slice(1) : t;

function fitBio(base, options, max = 70) {
  for (const o of options) { const t = `${base} · ${o}`; if (t.length <= max) return t; }
  return base.slice(0, max);
}

export function packaging({ me = {}, proofs = [], offers = [] } = {}) {
  const name = me.name || 'Ваше имя';
  const cases = proofs.filter(p => p.text).slice(0, 5);
  const top = cases[0]?.short || cases[0]?.text || 'ваш главный результат в цифрах';
  const main = offers.find(o => o.id === 'main') || offers.find(o => o.priceRub >= 100000) || offers[0] || { name: 'Аудит воронки', desc: '' };
  const tg = me.telegram || '@username';

  const resume = {
    title: 'Руководитель отдела продаж (проектно, ИП)',
    salary: 'от 250 000 ₽ — фильтр: только компании, готовые к результату',
    about: [
      `${top}.`,
      me.title ? `${cap(me.title)}.` : '',
      'Работаю проектно: без испытательного срока и затрат на трудоустройство, отвечаю за цифры, а не за часы.',
    ].filter(Boolean).join(' '),
    cases: cases.map((c, i) => `${i + 1}. ${c.text}${c.url ? ` (${c.url})` : ''}`),
    firstWeek: [
      'День 1–2: разбор воронки по цифрам — где теряются заявки и деньги.',
      'День 3: аудит менеджеров по записям звонков, скрипты и регламенты.',
      'День 4–5: план найма и KPI, первые изменения, которые дают результат в первый месяц.',
      'Итог недели: отчёт с цифрами «было → станет» и планом на 90 дней.',
    ],
    tips: [
      'В шапке — кейс с цифрами, а не «ответственный, 10 лет опыта».',
      '3–5 кейсов в формате «было → стало → результат».',
      'Поднимайте резюме каждые 4 часа — больше приглашений за тот же день.',
      'Без хобби и «по договорённости»: зарплатная вилка работает как фильтр.',
    ],
  };

  const telegram = {
    name: `${name} | отделы продаж`,
    bio: fitBio('Строю отделы продаж под ключ', [...cases.map(c => c.short).filter(Boolean), 'цифры, а не обещания']),
    pinned: [
      `Я — ${name}. ${me.title ? cap(me.title) + '.' : 'Строю отделы продаж и найм под ключ.'}`,
      '',
      cases.length ? 'Что уже сделано:' : '',
      ...cases.slice(0, 3).map(c => `— ${c.text}`),
      '',
      `Начинаем с ${main.priceRub ? `«${main.name}» (${fmtRub(main.priceRub)})` : 'бесплатного аудита воронки на 30 минут'}: разберу ваши цифры и скажу, что чинить первым. Если не смогу помочь — скажу прямо.`,
      '',
      `Написать: ${tg}`,
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n'),
  };
  return { resume, telegram };
}
