// Экономика: юнит-экономика воронки, окупаемость, ROI каналов, цена бездействия для клиента.
import { round, pct } from './util.js';

/**
 * Воронка «сигнал → касание → ответ → встреча → сделка».
 * Конверсии по умолчанию — консервативные ориентиры для персональных B2B-касаний собственнику
 * (их нужно заменить своими фактическими данными после первых 100 касаний: модуль Аналитика делает это сам).
 */
export const DEFAULT_FUNNEL = {
  signalsPerMonth: 600,      // вакансии/сигналы из HH и чатов
  researchRate: 0.5,         // доля, которую реально исследуем и пишем
  replyRate: 0.12,           // ответы на персональное касание
  meetingRate: 0.4,          // доля ответивших, кто соглашается на созвон
  showRate: 0.8,             // доходимость
  closeRate: 0.25,           // закрытие после диагностики
  avgCheckRub: 250000,       // средний чек (≥ 200 000 ₽)
  upsellRub: 50000,          // консалтинг/допродажа (как 50 000 ₽ у Дмитрия)
  costPerSignalRub: 15,      // данные + ИИ на одно исследование и сообщение
  fixedMonthlyRub: 30000,    // сервисы, почта, домены, подписки
  trafficSpendRub: 0,        // реклама, если подключена
  hoursPerMeeting: 1.5,
  usdRate: 92,
};

export function funnelModel(input = {}) {
  const f = { ...DEFAULT_FUNNEL, ...clean(input) };
  const touched = f.signalsPerMonth * f.researchRate;
  const replies = touched * f.replyRate;
  const meetingsBooked = replies * f.meetingRate;
  const meetingsHeld = meetingsBooked * f.showRate;
  const deals = meetingsHeld * f.closeRate;
  const revenue = deals * (f.avgCheckRub + f.upsellRub);
  const variable = touched * f.costPerSignalRub;
  const cost = variable + f.fixedMonthlyRub + f.trafficSpendRub;
  const profit = revenue - cost;
  const cac = deals ? cost / deals : null;
  const roi = cost ? (profit / cost) * 100 : null;
  const costPerMeeting = meetingsHeld ? cost / meetingsHeld : null;
  const revenuePerMeeting = meetingsHeld ? revenue / meetingsHeld : 0;
  const hours = meetingsHeld * f.hoursPerMeeting;
  return {
    input: f,
    touched: round(touched), replies: round(replies, 1), meetingsBooked: round(meetingsBooked, 1),
    meetingsHeld: round(meetingsHeld, 1), deals: round(deals, 1),
    revenueRub: round(revenue), costRub: round(cost), profitRub: round(profit),
    cacRub: cac === null ? null : round(cac), roiPct: roi === null ? null : round(roi),
    costPerMeetingRub: costPerMeeting === null ? null : round(costPerMeeting),
    revenuePerMeetingRub: round(revenuePerMeeting),
    revenuePerHourRub: hours ? round(revenue / hours) : 0,
    // Точка безубыточности: сколько сделок в месяц покрывают расходы.
    breakEvenDeals: round(cost / (f.avgCheckRub + f.upsellRub), 2),
    // Сколько сигналов нужно на 1 сделку — для планирования трафика.
    signalsPerDeal: deals ? round(f.signalsPerMonth / deals) : null,
  };
}

/** Окупаемость вложения: разовый платёж + ежемесячный эффект → месяцев до окупаемости. */
export function payback({ investRub = 0, monthlyGainRub = 0, monthlyCostRub = 0, months = 12 } = {}) {
  const net = monthlyGainRub - monthlyCostRub;
  const paybackMonths = net > 0 ? round(investRub / net, 1) : null;
  const roiPct = investRub + monthlyCostRub * months > 0
    ? round(((net * months - investRub) / (investRub + monthlyCostRub * months)) * 100)
    : null;
  const curve = [];
  let cum = -investRub;
  for (let m = 1; m <= months; m++) { cum += net; curve.push({ month: m, cumulativeRub: round(cum) }); }
  return { paybackMonths, roiPct, netMonthlyRub: round(net), totalNetRub: round(net * months - investRub), curve };
}

/**
 * «Цена бездействия» для собственника, который ищет РОПа/коммерческого директора:
 * пока вакансия открыта, отдел недорабатывает план. Даёт жёсткий факт для письма и для встречи.
 */
export function vacancyCost({ daysOpen = 30, salaryRub = 150000, managers = 3, planPerManagerRub = 600000, underperformance = 0.25 } = {}) {
  const lostPerMonth = managers * planPerManagerRub * underperformance;
  const lost = lostPerMonth * (daysOpen / 30);
  const hiringRisk = salaryRub * 3; // типичная цена ошибки найма руководителя: ~3 оклада
  return { lostRevenueRub: round(lost), lostPerMonthRub: round(lostPerMonth), badHireRiskRub: round(hiringRisk) };
}

/** ROI по каналам из фактических данных: расходы, лиды, встречи, сделки, выручка. */
export function channelRoi(rows = []) {
  return rows.map(r => {
    const spend = Number(r.spendRub) || 0;
    const rev = Number(r.revenueRub) || 0;
    return {
      ...r,
      cplRub: r.leads ? round(spend / r.leads) : null,
      costPerMeetingRub: r.meetings ? round(spend / r.meetings) : null,
      cacRub: r.deals ? round(spend / r.deals) : null,
      roiPct: spend ? round(((rev - spend) / spend) * 100) : null,
      leadToMeetingPct: pct(r.meetings || 0, r.leads || 0),
      meetingToDealPct: pct(r.deals || 0, r.meetings || 0),
    };
  });
}

/** Экономика SaaS-модели: абонентка + кредиты. */
export function saasModel({ clients = 20, planPriceRub = 39900, creditRevenuePerClientRub = 8000, churnMonthly = 0.06, cogsPct = 0.18, cacRub = 30000 } = {}) {
  const arpu = planPriceRub + creditRevenuePerClientRub;
  const mrr = clients * arpu;
  const grossMargin = 1 - cogsPct;
  const ltv = churnMonthly > 0 ? (arpu * grossMargin) / churnMonthly : null;
  return {
    arpuRub: round(arpu), mrrRub: round(mrr), arrRub: round(mrr * 12),
    ltvRub: ltv === null ? null : round(ltv), ltvToCac: ltv && cacRub ? round(ltv / cacRub, 1) : null,
    cacPaybackMonths: cacRub ? round(cacRub / (arpu * grossMargin), 1) : null,
  };
}

/** Рассрочка из калькулятора: наценки по способу оплаты. */
export const PAYMENT_TERMS = [
  { id: 'full', name: 'Сразу · без наценки', markup: 0, parts: 1 },
  { id: 'two', name: '2 платежа · +5%', markup: 0.05, parts: 2 },
  { id: 'three', name: '3 месяца · +10%', markup: 0.10, parts: 3 },
  { id: 'five', name: '5 месяцев · +25%', markup: 0.25, parts: 5 },
  { id: 'ten', name: '10 месяцев · +54%', markup: 0.54, parts: 10 },
  { id: 'bank', name: 'Банк · +20%', markup: 0.20, parts: 1 },
];

export function paymentPlan(priceRub, termId = 'full') {
  const t = PAYMENT_TERMS.find(x => x.id === termId) || PAYMENT_TERMS[0];
  const total = priceRub * (1 + t.markup);
  return { term: t, totalRub: round(total), perPaymentRub: round(total / t.parts) };
}

function clean(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v))) out[k] = Number(v);
  return out;
}
