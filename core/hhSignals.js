// Вакансия как сигнал: если компания ищет РОПа/коммерческого директора, собственник
// сам проводит отбор → есть повод для разговора и понятная боль. Здесь — нормализация,
// скоринг «нанимает ли собственник лично» и гипотезы боли для письма и встречи.
import { OWNER_HIRED_ROLES } from './catalog.js';
import { CURRENCIES, rateOf } from './currency.js';
import { stripHtml, daysBetween } from './util.js';
import { vacancyCost } from './economics.js';
import { roleAcc, plural } from './ru.js';
import { vacancyFlags } from './hhPlaybook.js';

/** Нормализует вакансию из ответа api.hh.ru (/vacancies и /vacancies/{id}). */
export function normalizeVacancy(v = {}) {
  const salary = v.salary || v.salary_range || null;
  const from = salary?.from || null, to = salary?.to || null;
  const gross = salary?.gross;
  const cur = salary?.currency === 'BYR' ? 'BYN' : salary?.currency;
  // Зарплата в тенге, сумах, долларах и т. д. — переводим в рубли по курсу (иначе скоринг hh.kz ломается).
  const salaryRub = !salary || !(to || from) ? null : (cur === 'RUR' || cur === 'RUB' || !cur) ? (to || from) : CURRENCIES.some(c => c.code === cur) ? Math.round((to || from) * rateOf(cur)) : null;
  return {
    id: String(v.id || ''),
    title: v.name || v.title || '',
    url: v.alternate_url || v.url || '',
    publishedAt: v.published_at || v.created_at || null,
    area: v.area?.name || v.area || '',
    salaryFrom: from, salaryTo: to, salaryRub, salaryGross: gross,
    employerId: v.employer?.id ? String(v.employer.id) : '',
    employerName: v.employer?.name || v.company || '',
    employerUrl: v.employer?.alternate_url || '',
    employerTrusted: !!v.employer?.trusted,
    snippet: stripHtml([v.snippet?.requirement, v.snippet?.responsibility].filter(Boolean).join(' ')),
    description: stripHtml(v.description || ''),
    experience: v.experience?.name || '',
    schedule: v.schedule?.name || '',
    keySkills: (v.key_skills || []).map(s => s.name || s),
  };
}

const OWNER_MARKERS = [
  ['собственник', 3], ['основател', 3], ['владелец', 3], ['подчинение генеральному', 3], ['подчинение собственнику', 4],
  ['напрямую с собственником', 4], ['напрямую с генеральным', 3], ['правая рука', 3], ['команда собственника', 3],
  ['небольшая компания', 2], ['молодая компания', 2], ['стартап', 1], ['с нуля', 2], ['построить отдел', 3], ['выстроить отдел', 3],
  ['масштабир', 2], ['выйти на', 1], ['рост в', 1], ['опцион', 2], ['доля', 2],
];
const PAIN_MARKERS = [
  { re: /с нуля|построить отдел|выстроить отдел|создать отдел/, pain: 'Отдела продаж как системы пока нет — строят с нуля.', offer: 'l3' },
  { re: /план|kpi|выполнени/, pain: 'Отдел нестабильно выполняет план — нужен человек, который «вытащит» цифры.', offer: 'setup' },
  { re: /найм|подбор|набрать команду|нанимать/, pain: 'Руководителю придётся самому нанимать менеджеров — найм станет узким местом.', offer: 'l2' },
  { re: /скрипт|регламент|стандарт/, pain: 'Нет скриптов и регламентов — результат держится на отдельных людях.', offer: 'l3' },
  { re: /crm|amocrm|битрикс/, pain: 'CRM есть или нужна, но воронка не считается по этапам.', offer: 'setup' },
  { re: /маркетинг|трафик|лидогенерац|директ|реклам/, pain: 'Нужен поток лидов: трафик и упаковка не дают стабильных заявок.', offer: 'setup' },
  { re: /b2b|корпоратив|тендер|крупн/, pain: 'Длинный B2B-цикл: сделки зависят от выхода на ЛПР.', offer: 'consult' },
  { re: /холодн|исходящ|outbound/, pain: 'Нужны исходящие продажи — а это система, а не «сильный продажник».', offer: 'setup' },
];

export const DEFAULT_FILTERS = {
  minSalary: 120000,
  coreKeywords: ['банкрот', 'бфл', 'списание долг', 'юридическ', 'онлайн-школ', 'b2b'],
  competitors: ['busywin', 'талантлинк', 'акулы', 'rentrop', 'рентроп', 'аренда роп'],
  stopNiches: ['недвижим'],
};

/** 0..100: вероятность, что отбор ведёт собственник лично и что у компании есть бюджет на чек ≥ 200 000 ₽. */
export function scoreVacancy(nv, opts = {}) {
  const f = { ...DEFAULT_FILTERS, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null && v !== '')) };
  const minSalaryRub = Number(f.minSalaryRub || f.minSalary) || 120000;
  const text = (nv.title + ' ' + nv.snippet + ' ' + nv.description).toLowerCase();
  const title = nv.title.toLowerCase();
  const emp = (nv.employerName || '').toLowerCase();
  let score = 0; const reasons = []; const stops = [];
  const role = OWNER_HIRED_ROLES.find(r => title.includes(r));
  if (role) { score += 35; reasons.push(`Топ-позиция «${role}» — отбирает первое лицо`); }
  for (const [m, w] of OWNER_MARKERS) if (text.includes(m)) { score += w * 3; reasons.push(`В тексте: «${m}»`); }
  if (nv.salaryRub) {
    if (nv.salaryRub >= 250000) { score += 20; reasons.push(`Доход до ${nv.salaryRub.toLocaleString('ru-RU')} ₽ — бюджет на чек 200+ тыс. есть`); }
    else if (nv.salaryRub >= minSalaryRub) { score += 12; reasons.push('Зарплата руководителя — компания платёжеспособна'); }
    else score -= 5;
  }
  if (nv.publishedAt) {
    const d = daysBetween(nv.publishedAt);
    if (d >= 21) { score += 8; reasons.push(`Вакансия висит ${d} дн. — закрыть не получается`); }
  }
  if (/кадров|агентств|рекрут|hr-агент/.test(emp)) { score -= 40; reasons.push('Похоже на кадровое агентство — не собственник'); }
  if (/сбер|втб|газпром|мтс|яндекс|ozon|wildberries|лукойл|ростелеком|x5|магнит/.test(emp)) { score -= 30; reasons.push('Корпорация — собственник не участвует в найме'); }
  if ((f.coreKeywords || []).some(k => k && text.includes(String(k).toLowerCase()))) { score += 10; reasons.push('Ниша из ядра'); }
  if (/удал[её]нн|удал[её]нка|гпх|самозанят|\bип\b|проектн/.test(text)) { score += 8; reasons.push('Можно проектно или удалённо'); }
  if (/(менеджер по продажам|оператор|специалист по продажам|sales manager)/.test(title) && !/(руковод|директор|роп|head|начальник)/.test(title)) { score -= 25; reasons.push('Линейная роль, не руководитель'); }
  if (/федеральн|сеть из \d+|\d+\s+филиал|департамент продаж|несколько роп/.test(text)) { score -= 15; reasons.push('Крупная сеть или департамент — решает не собственник'); }
  const comp = (f.competitors || []).find(k => k && (emp.includes(String(k).toLowerCase()) || text.includes(String(k).toLowerCase())));
  if (comp) stops.push('Прямой конкурент — смотрим как рынок, не откликаемся');
  const niche = (f.stopNiches || []).find(k => k && text.includes(String(k).toLowerCase()));
  if (niche) stops.push(`Ниша «${niche}…» в стоп-листе`);
  if (nv.salaryRub && nv.salaryRub < minSalaryRub) stops.push(`Зарплата ниже ${minSalaryRub.toLocaleString('ru-RU')} ₽`);
  if (stops.length) { score = Math.min(score, 10); reasons.unshift(...stops.map(x => 'Стоп: ' + x)); }
  score = Math.max(0, Math.min(100, score));
  return { score, reasons, role: role || null, stops, scoring10: Math.round(score / 10) };
}

export function painHypotheses(nv) {
  const text = (nv.title + ' ' + nv.snippet + ' ' + nv.description).toLowerCase();
  const found = PAIN_MARKERS.filter(p => p.re.test(text));
  const list = found.length ? found : [{ pain: 'Ищут руководителя продаж — значит, рост упёрся в систему, а не в людей.', offer: 'setup' }];
  return list.slice(0, 3).map(p => ({ pain: p.pain, offerId: p.offer }));
}

/** Факты из вакансии, которые можно честно упомянуть в письме. */
export function vacancyFacts(nv) {
  const facts = [];
  if (nv.title) facts.push({ kind: 'vacancy', text: `ищете ${roleAcc(nv.title)}`, source: nv.url || 'hh.ru' });
  if (nv.publishedAt) {
    const d = daysBetween(nv.publishedAt);
    if (d >= 0) facts.push({ kind: 'vacancy_age', text: d >= 14 ? `вакансия открыта уже ${d} дн.` : 'вакансия свежая', source: nv.url || 'hh.ru', days: d });
  }
  if (nv.salaryRub) facts.push({ kind: 'salary', text: `доход до ${nv.salaryRub.toLocaleString('ru-RU')} ₽`, source: nv.url || 'hh.ru' });
  if (nv.area) facts.push({ kind: 'area', text: `город: ${nv.area}`, source: 'hh.ru' });
  const req = nv.description.match(/(построить|выстроить|создать)[^.]{0,80}/i);
  if (req) facts.push({ kind: 'task', text: `задача в вакансии — «${req[0].trim()}»`, source: nv.url || 'hh.ru' });
  const team = nv.description.match(/(\d{1,2})\s*(менеджер[а-я]*)/i);
  if (team) facts.push({ kind: 'team', text: `в отделе продаж ${team[1]} ${plural(+team[1], 'менеджер', 'менеджера', 'менеджеров')}`, source: nv.url || 'hh.ru', n: Math.min(10, +team[1]) });
  const size = nv.description.match(/(\d{2,4})\s*(человек|сотрудник[а-я]*)/i);
  if (size) facts.push({ kind: 'size', text: `в компании ${size[1]} ${size[2]}`, source: nv.url || 'hh.ru' });
  return facts;
}

/** Из вакансии — сразу в лид: компания, факты, гипотезы, оценка «цены бездействия». */
export function vacancyToLead(raw, opts = {}) {
  const nv = normalizeVacancy(raw);
  const s = scoreVacancy(nv, opts.filters || opts);
  const facts = vacancyFacts(nv);
  const flags = vacancyFlags(nv.description + ' ' + nv.snippet);
  const team = facts.find(f => f.kind === 'team')?.n || 3;
  const age = facts.find(f => f.kind === 'vacancy_age')?.days || 30;
  const cost = vacancyCost({ daysOpen: Math.max(age, 14), salaryRub: nv.salaryRub || 150000, managers: team });
  cost.managers = team;
  return {
    company: nv.employerName,
    source: 'hh',
    sourceRef: nv.id,
    city: nv.area,
    industry: opts.niche || '',
    vacancy: nv,
    score: s.score,
    scoreReasons: s.reasons,
    stops: s.stops,
    flags,
    facts,
    hypotheses: painHypotheses(nv),
    inaction: cost,
    stage: 'new',
    contacts: {},
    owner: { name: '', role: 'Собственник / генеральный директор', social: {} },
  };
}

/** Запрос к HH для «топ-позиций, которые отбирает собственник». */
export function buildHhQueries({ roles = ['коммерческий директор', 'руководитель отдела продаж', 'директор по продажам', 'исполнительный директор', 'бизнес-ассистент собственника'], area = '', salaryFrom = 120000, period = 30 } = {}) {
  return roles.map(r => ({ text: `NAME:(${r})`, area, salary: salaryFrom, only_with_salary: false, period, per_page: 50, order_by: 'publication_time' }));
}
