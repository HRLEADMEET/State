// Лёгкая сводка лида для списков и счётчиков. Хранится рядом с документом (колонка summary в SQLite),
// чтобы список из тысяч лидов не требовал разбора полных карточек с фактами, историей и постами.
export function leadSummary(l = {}) {
  return {
    id: l.id, company: l.company || '', stage: l.stage, score: l.score ?? null, source: l.source || '', demo: !!l.demo, optOut: !!l.optOut,
    city: l.city || '', createdAt: l.createdAt, lastTouchAt: l.lastTouchAt || null,
    owner: { name: l.owner?.name || '', ...(l.owner?.style?.ok ? { style: { ok: true } } : {}) },
    ...(l.vacancy?.title || l.vacancy?.id ? { vacancy: { ...(l.vacancy.id ? { id: l.vacancy.id } : {}), title: l.vacancy.title || '' } } : {}),
    notes: l.notes ? String(l.notes).slice(0, 160) : '',
    ...(l.lastReply?.text ? { lastReply: { text: String(l.lastReply.text).slice(0, 200) } } : {}),
    ...(l.utm?.source ? { utm: { source: l.utm.source } } : {}),
    factsCount: l.facts?.length || 0, stopsCount: l.stops?.length || 0,
  };
}

/** Ключ для быстрых подсчётов: этап лида или статус письма/встречи/сделки. */
export const statusKey = (doc) => doc?.stage ?? doc?.status ?? null;
