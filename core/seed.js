// Демо-воронка «от сигнала до сделки» — прогоняется через тот же API, что и реальная работа.
// Это одновременно пример для обучения и сквозной тест всех этапов.
import { handle } from './router.js';
import { MOCK_VACANCIES, MOCK_EMPLOYERS, MOCK_SITES, MOCK_TELEGRAM, MOCK_TRANSCRIPT, MOCK_REPLY_DMITRY } from './mocks.js';
import { uid } from './util.js';
import { HttpError } from './util.js';

export function mockServices(extra = {}) {
  return {
    hh: {
      async search(ctx, q) {
        const t = (q.text || '').toLowerCase().replace(/name:\(|\)/g, '');
        const words = t.split(/\s+/).filter(w => w.length > 3);
        return { items: MOCK_VACANCIES.filter(v => words.some(w => v.name.toLowerCase().includes(w.slice(0, 6)))) };
      },
      async vacancy(ctx, id) { const v = MOCK_VACANCIES.find(x => x.id === id); if (!v) throw new HttpError(404, 'нет вакансии'); return v; },
      async employer(ctx, id) { const e = MOCK_EMPLOYERS[id]; if (!e) throw new HttpError(404, 'нет работодателя'); return e; },
    },
    web: {
      async fetch(url) { const k = String(url).replace(/\/$/, ''); if (MOCK_SITES[k]) return MOCK_SITES[k]; throw new Error('демо: сайт недоступен'); },
      async telegram(name) { if (MOCK_TELEGRAM[name]) return MOCK_TELEGRAM[name]; throw new Error('демо: канал не найден'); },
    },
    mail: { async send(ctx, m) { return { messageId: 'demo-' + uid() }; } },
    notify: async () => {},
    llm: { async available() { return false; } },
    ...extra,
  };
}

/** Небольшой детерминированный ГПСЧ для синтетической истории. */
function rnd(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

export async function seedDemo(ctx) {
  const api = (m, p, b) => handle(ctx, m, p, b);
  await api('PUT', '/settings', {
    me: { name: 'Влад Лев', telegram: '@vladlev007', email: 'vlad@leadmeet.example',
      mySample: 'Привет! Смотри, по цифрам всё просто: 29 360 откликов, 11 менеджеров на плане. Я не продаю часы — я отвечаю за результат. Давай созвонимся на 30 минут, покажу на твоих цифрах, где теряются деньги.' },
  });
  // Каналы: почта и HH включены, бот — для уведомлений.
  await api('PUT', '/channels/hh', { enabled: true, config: { userAgent: 'LeadmeetOS/0.8 (vlad@leadmeet.example)' } });
  await api('PUT', '/channels/email', { enabled: true, config: { host: 'smtp.example', port: '465', user: 'vlad@leadmeet.example', from: 'Влад Лев <vlad@leadmeet.example>', dailyCap: '30' } });
  await api('PUT', '/channels/telegram_personal', { enabled: true, config: { username: '@vladlev007' } });
  await api('PUT', '/channels/yandex_direct', { enabled: true, spendRub: 45000 });

  // 1) Сигналы из HH → импорт
  const found = await api('POST', '/hh/search', { minScore: 0 });
  const toImport = found.items.filter(x => x.preview.score >= 45).map(x => x.raw);
  const imp = await api('POST', '/hh/import', { items: toImport, niche: 'services' });
  const dmitry = imp.leads.find(l => l.company === 'ТехноСервис Про');
  const codelab = imp.leads.find(l => l.company === 'КодЛаб');

  // 2) Исследование: сайт + канал собственника → факты и стиль
  await api('PUT', '/leads/' + dmitry.id, { owner: { name: 'Орлов Дмитрий Сергеевич', role: 'Основатель и генеральный директор', social: { telegram: 'orlov_business' } }, contacts: { ownerEmail: 'd.orlov@technoservice-pro.example' }, industry: 'services' });
  await api('POST', `/leads/${dmitry.id}/research`, {});
  await api('PUT', '/leads/' + codelab.id, { owner: { name: 'Алексей Ким', role: 'CEO, основатель', social: { telegram: 'codelab_ceo' } }, industry: 'it' });
  await api('POST', `/leads/${codelab.id}/research`, {});

  // 3) Эксперимент заходов
  const exp = await api('POST', '/experiments', {
    name: 'Первое касание собственнику: 3 захода', metric: 'meeting',
    hypothesis: 'Факты о компании + «задайте любой вопрос» дают больше встреч, чем зацепка за вакансию.',
    variants: [{ id: 'A', name: 'Вакансия', hook: 'vacancy', offerId: 'audit' }, { id: 'B', name: 'Факты + вопрос', hook: 'facts', offerId: 'audit' }, { id: 'C', name: 'Вас нашла система', hook: 'system', offerId: 'platform' }],
  });

  // 4) Первое касание Дмитрию: вариант B, письмо
  const d = await api('POST', `/leads/${dmitry.id}/draft`, { experimentId: exp.id, variantId: 'B', channel: 'email', useLlm: false });
  const msg = await api('POST', `/leads/${dmitry.id}/messages`, { ...d, status: 'approved' });
  await api('POST', `/messages/${msg.id}/send`, { now: true });
  // 5) Ответ → классификация → встреча
  await api('POST', `/leads/${dmitry.id}/reply`, { text: MOCK_REPLY_DMITRY });
  const mt = await api('POST', `/leads/${dmitry.id}/meeting`, { at: nextThursday11(), link: 'https://telemost.yandex.ru/' });
  // 6) Звонок → разбор → сделка: консалтинг 50 000 + настройка 250 000 (как в кейсе)
  await api('POST', '/calls', { leadId: dmitry.id, meetingId: mt.id, transcript: MOCK_TRANSCRIPT, title: 'Диагностика: ТехноСервис Про', source: 'demo', deep: false });
  const deal = await api('POST', '/deals', { leadId: dmitry.id, items: [{ offerId: 'consult' }, { offerId: 'setup' }], paymentTerm: 'two', status: 'open', paidRub: 50000 });
  await api('PUT', '/deals/' + deal.id, { status: 'won', paidRub: 175000 });

  // 7) КодЛаб — письмо в Telegram, ждём ответа
  const d2 = await api('POST', `/leads/${codelab.id}/draft`, { experimentId: exp.id, variantId: 'C', channel: 'telegram', useLlm: false });
  const m2 = await api('POST', `/leads/${codelab.id}/messages`, { ...d2, status: 'approved' });
  await api('POST', `/messages/${m2.id}/send`, { now: true });

  // 8) Входящая заявка с сайта (виджет)
  const { inboundLead } = await import('./router.js');
  await inboundLead(ctx, 'site_form', { name: 'Марина', phone: '+7 916 000-00-00', company: 'Студия дизайна «Линия»', message: 'Хочу такую же систему привлечения клиентов', utm_source: 'yandex', utm_campaign: 'audit' });

  // 9) Синтетическая история касаний для A/B (чтобы аналитика была не пустой)
  await syntheticHistory(ctx, exp);
  return { experimentId: exp.id, dmitryId: dmitry.id, dealId: deal.id };
}

function nextThursday11() {
  const d = new Date(); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); d.setHours(11, 0, 0, 0); return d.toISOString();
}

const FAKE = ['Альфа Логистик', 'Гранд Мебель', 'ЭкоКлин', 'Фитнес Лайн', 'Юрфирма «Право»', 'АвтоДеталь', 'Пекарня №1', 'Сервис-Холод', 'Дент Арт', 'Лингва Школа', 'ПромСнаб', 'IT Bridge', 'Тату Лаб', 'Дом Окон', 'Клиника Здоровье', 'Агро Трейд', 'Digital Nord', 'Кофе Пойнт', 'ВелоМир', 'Арт Декор', 'Seo Pro', 'ТрансКарго', 'Бьюти Студия', 'Smart Home', 'Экспо Груп', 'Мир Плитки', 'Финконсалт', 'СтройМаркет', 'Аква Сервис', 'Ремонт Плюс', 'Медиа Пульс', 'Элит Тур', 'Кейтеринг Про', 'Оптика Взгляд', 'Робошкола', 'Детали Урал', 'Психолог Онлайн', 'Ветклиника Лапа', 'Event Craft', 'Юни Софт', 'Стом Мастер', 'Коучинг Плюс', 'ДатаЛаб', 'Флор Студио', 'Принт Экспресс'];

async function syntheticHistory(ctx, exp) {
  const r = rnd(20261104);
  const p = { A: { reply: 0.10, meet: 0.45 }, B: { reply: 0.22, meet: 0.55 }, C: { reply: 0.16, meet: 0.5 } };
  const ws = ctx.ws.id;
  for (let i = 0; i < FAKE.length; i++) {
    const v = ['A', 'B', 'C'][i % 3];
    const hook = exp.variants.find(x => x.id === v).hook;
    const daysAgo = 3 + Math.floor(r() * 25);
    const at = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const replied = r() < p[v].reply * 1.6;
    const meeting = replied && r() < p[v].meet;
    const won = meeting && r() < 0.3;
    const stage = won ? 'won' : meeting ? 'meeting' : replied ? 'replied' : 'contacted';
    const lead = { id: uid('l_'), demo: true, company: FAKE[i], stage, source: i % 5 === 0 ? 'tg_chats' : 'hh', score: 40 + Math.floor(r() * 50), owner: { name: '', social: {} }, contacts: {}, facts: [], hypotheses: [], history: [{ at, stage }], createdAt: at, updatedAt: at };
    await ctx.store.put(ws, 'leads', lead);
    const m = { id: uid('m_'), leadId: lead.id, direction: 'out', channel: i % 4 === 0 ? 'telegram' : 'email', subject: 'демо', body: 'демо-касание', hook, experimentId: exp.id, variantId: v, status: 'sent', sentAt: at, repliedAt: replied ? at : null, replyKind: replied ? 'positive' : null, createdAt: at, updatedAt: at };
    await ctx.store.put(ws, 'messages', m);
    if (won) await ctx.store.put(ws, 'deals', { id: uid('d_'), leadId: lead.id, company: lead.company, items: [{ offerId: 'setup', name: 'Настройка системы', priceRub: 250000 }], amountRub: 250000, status: 'won', createdAt: at, updatedAt: at, demo: true });
  }
}
