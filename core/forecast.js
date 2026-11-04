// «Что даст 100»: прогноз воронки на языке клиента. Каждое число помечено: факт (с источником) или допущение.
import { round, fmtRub, fmtUsd } from './util.js';

export const BENCHMARKS = {
  responseToDialog: { v: 0.05, kind: 'норматив', src: 'Скрипт менеджера HH v2: «100 откликов → 5 диалогов»' },
  responseToTargetLead: { v: 0.027, kind: 'факт', src: 'Кейс HH-партизан: «отклик → целевой лид 2,7%»' },
  leadToBooked: { v: 0.5, kind: 'допущение', src: 'Половина целевых лидов соглашается на аудит 20–30 мин' },
  showRate: { v: 0.6, kind: 'норматив', src: 'Скрипт менеджера HH v2: «5 встреч в неделю, из них 3 доходят»' },
  closeBefore: { v: 0.14, kind: 'факт', src: 'Кейс HH-партизан: встреча → продажа 14% до разбора звонков' },
  closeAfter: { v: 0.28, kind: 'факт', src: 'Кейс HH-партизан: 28% после разбора 10 встреч' },
  checkLow: { v: 120000, kind: 'факт', src: 'Тариф «НАЙМ МОП» от 120 000 ₽' },
  checkBase: { v: 250000, kind: 'факт', src: 'Настройка системы 250 000 ₽ (кейс «Дмитрий»)' },
  checkHigh: { v: 450000, kind: 'допущение', src: 'Средний чек трёх сделок кейса (≈1,5 млн ₽ / 3), часть сумм — апсейлы' },
  responsesPerDay: { v: 60, kind: 'факт', src: 'Кейс HH-партизан: 50–80 откликов в день' },
  minutesPerTouch: { v: 1.5, kind: 'допущение', src: 'Конвейер: скопировать, открыть чат, отправить' },
};

const SCEN = {
  pessimistic: { name: 'Осторожно', leadToBooked: 0.4, showRate: 0.5, close: 'closeBefore', check: 'checkLow' },
  base: { name: 'База', leadToBooked: 0.5, showRate: 0.6, close: 'closeAfter', check: 'checkBase' },
  optimistic: { name: 'Хорошо', leadToBooked: 0.6, showRate: 0.75, close: 'closeAfter', check: 'checkHigh' },
};

/** unit: 'responses' — 100 откликов на hh; 'leads' — 100 целевых собственников. */
export function forecast({ n = 100, unit = 'leads', usdRate = 92, upsellRub = 0, checkOverride = null } = {}) {
  const B = BENCHMARKS;
  const rows = Object.entries(SCEN).map(([id, s]) => {
    const leads = unit === 'responses' ? n * B.responseToTargetLead.v : n;
    const booked = leads * s.leadToBooked;
    const held = booked * s.showRate;
    const close = B[s.close].v;
    const deals = held * close;
    const check = (checkOverride || B[s.check].v) + upsellRub;
    const revenue = deals * check;
    return { id, name: s.name, leads: round(leads, 1), booked: round(booked, 1), held: round(held, 1), closePct: round(close * 100), deals: round(deals, 2), checkRub: check, revenueRub: round(revenue), revenueUsd: round(revenue / usdRate) };
  });
  const base = rows.find(r => r.id === 'base');
  // Сколько откликов в месяц нужно на цель 1,5 млн ₽ (как в кейсе) при базовом сценарии.
  const perResponse = base.revenueRub / (unit === 'responses' ? n : n / B.responseToTargetLead.v);
  const responsesFor = (goal) => perResponse ? Math.ceil(goal / perResponse) : null;
  const goal = 1_500_000;
  const need = responsesFor(goal);
  const monthResponses = B.responsesPerDay.v * 22;
  const monthRevenue = round(perResponse * monthResponses);
  const perDayForGoal = need ? Math.ceil(need / 22) : null;
  const phoneHoursPerDay = round((B.responsesPerDay.v * B.minutesPerTouch.v) / 60, 1);
  return { n, unit, rows, goal: { rub: goal, responses: need, perDayForGoal, monthResponses, monthRevenue, phoneHoursPerDay }, benchmarks: B };
}

/** Текст для клиента: коротко, на его языке, с цифрами и честными допущениями. */
export function clientText(f, { niche = 'вашей нише', usdRate = 92 } = {}) {
  const b = f.rows.find(r => r.id === 'base'), lo = f.rows.find(r => r.id === 'pessimistic'), hi = f.rows.find(r => r.id === 'optimistic');
  const what = f.unit === 'responses' ? `${f.n} откликов на hh.ru` : `${f.n} целевых собственников (с потоком заявок и задачей усилить продажи)`;
  const money = (x) => `${fmtRub(x)} (${fmtUsd(x / usdRate)})`;
  const num = (x) => (Math.round(x * 10) / 10).toLocaleString('ru-RU');
  return [
    `Что дадут ${what} в ${niche}:`,
    f.unit === 'responses' ? `— из них целевых собственников ≈ ${num(b.leads)} (2,7% по нашему кейсу);` : '',
    `— базовый сценарий: назначено встреч ≈ ${num(b.booked)}, проведено ≈ ${num(b.held)}, сделок ≈ ${num(b.deals)}, выручка ≈ ${money(b.revenueRub)};`,
    `— осторожный: ≈ ${money(lo.revenueRub)}; хороший: ≈ ${money(hi.revenueRub)}.`,
    `Откуда цифры: отклик → целевой лид 2,7% и встреча → продажа 28% — из нашего кейса; доходимость 3 из 5 — из рабочего норматива; остальное — допущения, которые проверяем на первых 100 касаниях.`,
    f.goal.responses ? `При 60 откликах в день (≈${f.goal.monthResponses.toLocaleString('ru-RU')} в месяц, около ${String(f.goal.phoneHoursPerDay).replace('.', ',')} ч в день в телефоне) базовый сценарий даёт ≈ ${money(f.goal.monthRevenue)} в месяц. Для 1,5 млн ₽ в месяц нужно ≈ ${f.goal.perDayForGoal} откликов в день — или выше чек и конверсия встреч.` : '',
  ].filter(Boolean).join('\n');
}
