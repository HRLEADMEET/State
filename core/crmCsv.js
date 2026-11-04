// Совместимость с CRM-файлом агента (LEADMEET_CRM_лиды_HH.csv): импорт и экспорт в том же формате,
// чтобы локальный агент на компьютере и приложение работали с одной таблицей.
import { uid, nowIso, safeUrl, isEmail, clip } from './util.js';

export const CRM_COLUMNS = ['Дата сигнала', 'Компания', 'Ниша', 'Источник', 'Контакт', 'Роль', 'Ссылка', 'ЗП', 'Статус', 'Следующий шаг', 'Кто', 'Комментарий'];

/** CSV с разделителем «;», кавычками и переносами внутри полей (RFC 4180). */
export function parseCsv(text = '', sep = ';') {
  const s = String(text).replace(/^﻿/, '');
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows.map(r => r.map(x => x.trim()));
}

export function toCsv(rows, sep = ';') {
  const esc = (v) => { const t = v == null ? '' : String(v); return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return '﻿' + rows.map(r => r.map(esc).join(sep)).join('\n') + '\n';
}

/** Статус из таблицы → этап воронки. */
export function statusToStage(status = '') {
  const s = status.toLowerCase();
  if (/(^|\s)(х|x)[,\s]|отказ|закрыт|отсеян|не подходит|снят|пропущен/.test(s)) return 'lost';
  if (/встреч|созвон назначен|аудит назначен/.test(s)) return 'meeting';
  if (/стадия 1|живой ответ|ответ работодателя|ответ,|^ответ|приглашени|формат отправлен|анкета/.test(s)) return 'replied';
  if (/отклик|стадия 0|написали|письмо/.test(s)) return 'contacted';
  if (/исследован/.test(s)) return 'researched';
  return 'new';
}

const stageToStatus = { new: 'Новый', researched: 'Исследован', contacted: 'Отклик, стадия 0', replied: 'Стадия 1, живой ответ', meeting: 'Встреча назначена', won: 'Сделка', lost: 'Х, отказ' };

function parseSalary(t = '') {
  const nums = (String(t).replace(/\s/g, '').match(/\d+(?:[.,]\d+)?[кk]?/gi) || []).map(n => /[кk]$/i.test(n) ? parseFloat(n) * 1000 : parseFloat(n.replace(',', '.'))).filter(n => n >= 10000);
  return nums.length ? Math.max(...nums) : null;
}

/** Импорт строк CRM-таблицы в лиды (без дублей по ссылке на вакансию или компании+роли). */
export function rowsToLeads(rows, existing = []) {
  if (!rows.length) return { leads: [], skipped: 0 };
  const head = rows[0].map(h => h.toLowerCase());
  const col = (name) => head.findIndex(h => h.startsWith(name.toLowerCase()));
  const idx = Object.fromEntries(CRM_COLUMNS.map(c => [c, col(c)]));
  const get = (r, c) => idx[c] >= 0 ? (r[idx[c]] || '') : '';
  const seen = new Set(existing.map(l => (l.vacancy?.url || '') + '|' + (l.company || '').toLowerCase()));
  const leads = []; let skipped = 0;
  for (const r of rows.slice(1)) {
    const company = clip(get(r, 'Компания'), 300);
    if (!company) { skipped++; continue; }
    const link = get(r, 'Ссылка');
    const url = safeUrl(link);
    const key = url + '|' + company.toLowerCase();
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    const contact = get(r, 'Контакт');
    const comment = get(r, 'Комментарий');
    const status = get(r, 'Статус');
    const emails = (contact + ' ' + comment).match(/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,4}\.[A-Za-z]{2,24}/g) || [];
    const chat = (comment + ' ' + link + ' ' + status).match(/чат\s*(\d{6,})/i)?.[1] || '';
    const scoring = comment.match(/скоринг\s*(\d+)/i)?.[1];
    const ownerName = /нет данных|ии-помощник/i.test(contact) ? '' : contact.split(/[,(;]/)[0].trim();
    const stage = statusToStage(status);
    const date = get(r, 'Дата сигнала');
    const createdAt = /^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(date + 'T09:00:00Z').toISOString() : nowIso();
    leads.push({
      id: uid('l_'), stage, source: 'crm:' + (get(r, 'Источник').split(/[,:]/)[0] || 'hh').toLowerCase().slice(0, 40),
      company, industry: '', city: '', site: '',
      score: scoring ? Math.min(100, Number(scoring) * 10) : 50,
      owner: { name: clip(ownerName, 120), role: /собственник|владел|основател/i.test(contact) ? 'Собственник' : '', social: {} },
      contacts: { emails: [...new Set(emails.filter(isEmail))], phones: [] },
      vacancy: { title: clip(get(r, 'Роль'), 200), url: /hh\.(ru|kz)\/vacancy/.test(url) ? url : '', salaryRub: parseSalary(get(r, 'ЗП')), description: '' },
      hh: { chatId: chat, status: clip(status, 300) },
      facts: [get(r, 'Ниша') && !/нет данных/i.test(get(r, 'Ниша')) ? { kind: 'crm', text: 'ниша: ' + clip(get(r, 'Ниша'), 200), source: 'CRM' } : null].filter(Boolean),
      hypotheses: [{ pain: 'Ищут руководителя продаж — рост упёрся в систему, а не в людей.', offerId: 'setup' }],
      nextStep: clip(get(r, 'Следующий шаг'), 500), assignee: clip(get(r, 'Кто'), 60),
      notes: clip(comment, 3000), history: [{ at: createdAt, stage }], createdAt, updatedAt: nowIso(),
      ...(stage === 'lost' ? { lostReason: clip(status, 200) } : {}),
    });
  }
  return { leads, skipped };
}

/** Экспорт лидов в тот же формат, что читает агент. */
export function leadsToRows(leads) {
  const rows = [CRM_COLUMNS];
  for (const l of leads) {
    if (l.demo) continue;
    rows.push([
      String(l.createdAt || '').slice(0, 10), l.company || '', (l.facts || []).find(f => f.kind === 'crm')?.text?.replace(/^ниша: /, '') || l.industry || '',
      l.source || '', [l.owner?.name, l.contacts?.ownerEmail || l.contacts?.emails?.[0]].filter(Boolean).join(', ') || 'нет данных',
      l.vacancy?.title || '', l.vacancy?.url || (l.hh?.chatId ? 'чат ' + l.hh.chatId : '') || l.site || '',
      l.vacancy?.salaryRub ? `до ${l.vacancy.salaryRub.toLocaleString('ru-RU')} ₽` : 'нет данных',
      l.hh?.status && statusToStage(l.hh.status) === l.stage ? l.hh.status : stageToStatus[l.stage] || l.stage,
      l.nextStep || '', l.assignee || '', [l.score != null ? `Скоринг ${Math.round(l.score / 10)}` : '', l.notes || ''].filter(Boolean).join('. ').slice(0, 3000),
    ]);
  }
  return rows;
}
