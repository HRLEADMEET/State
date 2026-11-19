// Тесты метода HH-партизан, конвейера, автопилота, CRM-файла, прогноза и защитных функций.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hhSafetyCheck, vacancyFlags, responseLetter, dialogSteps, meetingSlots, followUpCadence } from '../core/hhPlaybook.js';
import { parseCsv, toCsv, rowsToLeads, leadsToRows, statusToStage } from '../core/crmCsv.js';
import { forecast, clientText } from '../core/forecast.js';
import { unverifiedNumbers, checkMessage } from '../core/quality.js';
import { scoreVacancy, normalizeVacancy } from '../core/hhSignals.js';
import { parsePeople } from '../core/research.js';
import { deepMerge, safeUrl, isEmail, sanitizeObject } from '../core/util.js';
import { MemStore } from '../core/memStore.js';
import { seedDemo, mockServices } from '../core/seed.js';
import { handle, pipeline } from '../core/router.js';

const ctxNew = async (credits = 5000) => {
  const store = new MemStore();
  const ws = store.createWorkspace({ name: 't', credits });
  const ctx = { store, ws, user: { id: 'u' }, role: 'owner', services: mockServices(), demo: true };
  return ctx;
};

test('hh-безопасность: слова-триггеры и ссылки ловятся, честный отклик проходит', () => {
  assert.ok(hhSafetyCheck('Внедрю систему продаж под ключ, вот кейсы: https://t.me/x').length >= 4);
  const r = responseLetter({ lead: { vacancy: { title: 'РОП' } } });
  assert.equal(r.issues.length, 0, JSON.stringify(r.issues));
  assert.match(r.text, /честно о формате/);
  for (const s of dialogSteps({ lead: {} }).filter(s => s.channel === 'hh')) assert.equal(hhSafetyCheck(s.text).length, 0, s.id);
});

test('флаги вакансии: кодовое слово подставляется в начало отклика, тест и анкета — решение человека', () => {
  const desc = 'В начале отклика напишите «Ракета», иначе не рассмотрим. Обязательно пройдите тест и заполните анкету.';
  const flags = vacancyFlags(desc);
  assert.ok(flags.some(f => f.id === 'code_word' && f.value === 'Ракета'));
  assert.ok(flags.some(f => f.id === 'test' && f.human));
  assert.ok(flags.some(f => f.id === 'form' && f.human));
  const r = responseLetter({ lead: { vacancy: { title: 'РОП', description: desc } } });
  assert.ok(r.text.startsWith('Ракета'));
});

test('слоты встречи: рабочие дни, московское время и местное', () => {
  const slots = meetingSlots({ now: new Date('2026-11-06T05:00:00Z') }); // пятница
  assert.equal(slots.length, 3);
  assert.ok(slots.every(s => !/сб|вс/.test(s.label)));
  assert.match(slots[0].label, /11:00 мск/);
  assert.match(slots[0].mine, /15:00/); // Нячанг = МСК + 4
});

test('дожим после встречи: 4 касания, без выдуманных цифр', () => {
  const c = followUpCadence({ lead: { owner: { name: 'Иван Петров' } }, painLine: 'недобор 450 000 ₽ в месяц' });
  assert.equal(c.length, 4);
  assert.match(c[3].text, /не хочу быть навязчивым/i);
});

test('CRM-файл агента: статусы → этапы, скоринг, чат, экспорт обратно в тот же формат', () => {
  const csv = '﻿Дата сигнала;Компания;Ниша;Источник;Контакт;Роль;Ссылка;ЗП;Статус;Следующий шаг;Кто;Комментарий\n'
    + '2026-11-03;Альфа;БФЛ;hh.ru;нет данных;РОП;https://hh.ru/vacancy/1;150-250К;Отклик 03.11 11:16 мск;Ждём ответ;Агент;"Скоринг 7. Чат 5764229674; удалённо"\n'
    + '2026-11-03;Бета;Опт;hh.ru;Анна;РОП;https://hh.ru/vacancy/2;от 200 000 ₽;Х, отказ 15:42 мск;Закрыт;Агент;\n'
    + '2026-11-04;Гамма;Медицина;hh.ru;info@gamma.example;РОП;https://hh.ru/vacancy/3;нет данных;Стадия 1, ответ работодателя 04.11;Ждём слоты;Агент;Скоринг 6';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 4);
  const { leads } = rowsToLeads(rows);
  assert.deepEqual(leads.map(l => l.stage), ['contacted', 'lost', 'replied']);
  assert.equal(leads[0].score, 70);
  assert.equal(leads[0].hh.chatId, '5764229674');
  assert.equal(leads[0].vacancy.salaryRub, 250000);
  assert.deepEqual(leads[2].contacts.emails, ['info@gamma.example']);
  const back = parseCsv(toCsv(leadsToRows(leads)));
  assert.equal(back[0][1], 'Компания');
  assert.equal(back.length, 4);
  assert.equal(rowsToLeads(rows, leads).leads.length, 0, 'повторный импорт не создаёт дублей');
  assert.equal(statusToStage('Снят 03.11, недвижимость не берём'), 'lost');
});

test('прогноз «Что даст 100»: сценарии упорядочены, текст честно называет источники', () => {
  const f = forecast({ n: 100, unit: 'leads' });
  const [lo, base, hi] = f.rows;
  assert.ok(lo.revenueRub < base.revenueRub && base.revenueRub < hi.revenueRub);
  assert.equal(base.closePct, 28);
  const t = clientText(f, { niche: 'IT' });
  assert.match(t, /из нашего кейса/);
  assert.match(t, /допущения/);
  const r = forecast({ n: 100, unit: 'responses' });
  assert.equal(r.rows[1].leads, 2.7);
});

test('оценщик: неподтверждённая цифра помечается, подтверждённая — нет', () => {
  const lead = { facts: [{ text: 'в компании 40 человек' }] };
  assert.deepEqual(unverifiedNumbers('У вас 40 человек и 999 клиентов. Созвон 30 минут в 11:00.', lead, ''), ['999 клиент']);
  const q = checkMessage({ subject: 'вопрос', body: 'Иван, у вас 40 человек. Курс 5 000 тенге и 5 000 ₽? Если неактуально — не напишу.', channel: 'email', lead: { ...lead, company: 'Ромашка', owner: { name: 'Иван' } } });
  assert.ok(q.issues.some(i => /валюту/.test(i.msg)));
});

test('скоринг: конкурент и стоп-ниша получают стоп, линейная роль — штраф', () => {
  const comp = scoreVacancy(normalizeVacancy({ name: 'РОП', employer: { name: 'BUSYWIN' }, description: 'строим отделы' }));
  assert.ok(comp.stops.length && comp.score <= 10);
  const realty = scoreVacancy(normalizeVacancy({ name: 'Руководитель отдела продаж', employer: { name: 'Агентство' }, description: 'агентство недвижимости, отдел с нуля' }));
  assert.ok(realty.stops.some(s => /недвижим/.test(s)));
  const line = scoreVacancy(normalizeVacancy({ name: 'Менеджер по продажам', employer: { name: 'ООО Ромашка' }, description: '' }));
  assert.ok(line.reasons.some(r => /Линейная роль/.test(r)));
});

test('поиск ЛПР на странице команды', () => {
  const p = parsePeople('<div>Антон Палюлин</div><div>Основатель</div><p>Фатима Кунбутаева — коммерческий директор</p>');
  assert.equal(p[0].name, 'Антон Палюлин');
  assert.equal(p[0].role, 'собственник');
  assert.ok(p.some(x => x.role === 'коммерческий директор'));
});

test('защита: прототип, ссылки, email', () => {
  const merged = deepMerge({}, JSON.parse('{"__proto__":{"polluted":1},"constructor":{"prototype":{"x":1}},"a":1}'));
  assert.equal(({}).polluted, undefined);
  assert.equal(merged.a, 1);
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<b>'), '');
  assert.equal(safeUrl('example.com'), 'https://example.com');
  assert.equal(isEmail('a@b.ru\r\nRCPT TO:<x@y.z>'), false);
  assert.equal(isEmail('ivan.petrov@romashka.ru'), true);
  assert.equal(Object.keys(sanitizeObject(JSON.parse('{"__proto__":1,"ok":2}'))).join(), 'ok');
});

test('конвейер: подготовка, лимиты каналов, капча hh и правило «нет ответа 3 дня»', async () => {
  const ctx = await ctxNew();
  await seedDemo(ctx);
  const q = await handle(ctx, 'GET', '/queue');
  assert.ok(q.items.length >= 1);
  assert.ok(q.caps.telegram.cap === 25);
  // Капча: третий отклик через API возвращает ссылку на капчу (так настроен мок hh).
  const leads = await handle(ctx, 'GET', '/leads');
  const fresh = leads.filter(l => l.vacancy?.id && !l.demo).slice(0, 3);
  let captcha = 0;
  for (const l of fresh) {
    const m = await handle(ctx, 'POST', `/leads/${l.id}/messages`, { channel: 'hh_apply', body: 'Здравствуйте! Откликаюсь.', status: 'approved' });
    const r = await handle(ctx, 'POST', `/queue/${m.id}/act`, { action: 'apply' });
    if (r.captcha) captcha++;
  }
  assert.ok(captcha >= 1, 'должна появиться капча для решения человеком');
  // Лимит: telegram = 0 → отправка блокируется.
  await handle(ctx, 'PUT', '/settings', { caps: { telegram: 0 } });
  const l = leads.find(x => !x.demo && x.stage !== 'won');
  const m2 = await handle(ctx, 'POST', `/leads/${l.id}/messages`, { channel: 'telegram', body: 'привет?', status: 'approved', to: '@x' });
  await assert.rejects(handle(ctx, 'POST', `/queue/${m2.id}/act`, { action: 'sent' }), /лимит/i);
  // Правило «нет ответа»: отклик hh 4 дня назад без ответа → вечером отказ.
  const all = await handle(ctx, 'GET', '/leads');
  const target = all.find(x => x.stage === 'contacted' && !x.demo);
  const msgs = await handle(ctx, 'GET', '/messages');
  for (const mm of msgs.filter(x => x.leadId === target.id)) { mm.channel = 'hh_apply'; mm.repliedAt = null; mm.sentAt = new Date(Date.now() - 4 * 86400000).toISOString(); await ctx.store.put(ctx.ws.id, 'messages', mm); }
  const lead = await ctx.store.get(ctx.ws.id, 'leads', target.id); lead.lastTouchAt = new Date(Date.now() - 4 * 86400000).toISOString(); await ctx.store.put(ctx.ws.id, 'leads', lead);
  const ev = await handle(ctx, 'POST', '/autopilot/run', { phase: 'evening' });
  assert.match(ev.summary, /Итог дня/);
  assert.equal((await ctx.store.get(ctx.ws.id, 'leads', target.id)).stage, 'lost');
});

test('автопилот срабатывает по часу в часовом поясе владельца и только раз в день', async () => {
  const ctx = await ctxNew();
  await handle(ctx, 'PUT', '/settings', { autopilot: { enabled: true, morningHour: 8, eveningHour: 20 }, tz: { mine: 'Asia/Ho_Chi_Minh' } });
  const at9 = new Date('2026-11-05T02:00:00Z'); // 09:00 в Нячанге
  const r1 = await pipeline.autopilotTick(ctx, at9);
  assert.equal(r1?.phase, 'morning');
  assert.equal(await pipeline.autopilotTick(ctx, at9), null, 'второй раз в тот же день не запускается');
  const at21 = new Date('2026-11-05T14:00:00Z'); // 21:00 в Нячанге
  assert.equal((await pipeline.autopilotTick(ctx, at21))?.phase, 'evening');
});

test('кабинет клиента: лимит по тарифу и кредиты только переводом из своего баланса', async () => {
  const ctx = await ctxNew(100);
  ctx.ws.plan = 'start';
  await ctx.store.saveWorkspace({ ...ctx.ws, plan: 'start' });
  await assert.rejects(handle(ctx, 'POST', '/workspaces', { name: 'Клиент' }), /Тариф/);
  await ctx.store.saveWorkspace({ ...(await ctx.store.getWorkspace(ctx.ws.id)), plan: 'agency' });
  await assert.rejects(handle(ctx, 'POST', '/workspaces', { name: 'Клиент', credits: 1000 }), /Недостаточно кредитов/);
  const w = await handle(ctx, 'POST', '/workspaces', { name: 'Клиент', credits: 40 });
  assert.equal(w.credits, 40);
  assert.equal((await ctx.store.getWorkspace(ctx.ws.id)).credits, 60);
  const childSettings = await ctx.store.get(w.id, 'settings', 'main');
  assert.deepEqual(childSettings.proofs, [], 'клиент не получает чужие кейсы');
});
