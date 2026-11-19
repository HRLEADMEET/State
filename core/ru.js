// Русская морфология для шаблонов: падежи должностей, склонение числительных.

const NOUN_GEN = { директор: 'директора', руководитель: 'руководителя', менеджер: 'менеджера', ассистент: 'ассистента', 'бизнес-ассистент': 'бизнес-ассистента',
  маркетолог: 'маркетолога', помощник: 'помощника', заместитель: 'заместителя', управляющий: 'управляющего', роп: 'РОПа', cmo: 'CMO', coo: 'COO', cto: 'CTO', 'head': 'head' };

/** Должность в родительном/винительном падеже: «коммерческий директор» → «коммерческого директора». */
export function roleAcc(title = '') {
  const t = String(title).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*[,/].*$/, '').trim().toLowerCase();
  if (!t) return 'руководителя продаж';
  const ws = t.split(/\s+/); const out = []; let done = false;
  for (const w of ws) {
    if (done) { out.push(w); continue; }
    if (NOUN_GEN[w]) { out.push(NOUN_GEN[w]); done = true; continue; }
    if (/(ый|ий)$/.test(w)) { out.push(w.replace(/ый$/, 'ого').replace(/(?<=[кгхжшчщ])ий$/, 'ого').replace(/ий$/, 'его')); continue; }
    out.push(w); done = true;
  }
  return out.join(' ').replace(/\bроп\b/i, 'РОП');
}


export function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; }
