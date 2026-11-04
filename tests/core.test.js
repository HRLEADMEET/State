import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStyle, applyStyle } from '../core/stylometry.js';
import { draftMessage, roleAcc } from '../core/generator.js';
import { checkMessage, classifyReply } from '../core/quality.js';
import { vacancyToLead, scoreVacancy, normalizeVacancy } from '../core/hhSignals.js';
import { evaluate, wilson } from '../core/abtest.js';
import { analyzeCall } from '../core/callAnalysis.js';
import { funnelModel, payback, paymentPlan } from '../core/economics.js';
import { parseSite, parseTelegramChannel } from '../core/research.js';
import { MemStore } from '../core/memStore.js';
import { seedDemo, mockServices } from '../core/seed.js';
import { handle } from '../core/router.js';
import { MOCK_VACANCIES, MOCK_TRANSCRIPT, MOCK_SITES, MOCK_TELEGRAM } from '../core/mocks.js';
import { fmtMoney, addressName } from '../core/util.js';

test('деньги показываются в рублях и в долларах', () => {
  assert.equal(fmtMoney(250000, 92).replace(/\s/g, ' '), '250 000 ₽ ($2 717)');
});

test('обращение по имени и отчеству', () => {
  assert.equal(addressName('Орлов Дмитрий Сергеевич'), 'Дмитрий Сергеевич');
  assert.equal(addressName('Алексей Ким', false), 'Алексей');
});

test('должности склоняются', () => {
  assert.equal(roleAcc('Коммерческий директор'), 'коммерческого директора');
  assert.equal(roleAcc('Руководитель отдела продаж (РОП)'), 'руководителя отдела продаж');
  assert.equal(roleAcc('Технический директор'), 'технического директора');
});

test('стиль: определяет «ты», эмодзи и переводит письмо на «ты»', () => {
  const st = analyzeStyle('Привет, друзья! 🔥 Ты собственник? Тогда ты знаешь, как сложно найти РОПа. Мы нашли. Пиши в личку 🚀 Система решает всё. Без системы — хаос.');
  assert.equal(st.ok, true);
  assert.equal(st.formality, 'ty');
  const out = applyStyle('Здравствуйте, Дмитрий! Вы ищете РОПа? Задайте мне любой вопрос о вашей компании.', st);
  assert.match(out, /Привет/);
  assert.match(out, /ты ищешь|Ты ищешь/);
  assert.match(out, /твоей компании/);
});

test('стиль: слишком мало текста — понятная ошибка', () => {
  assert.equal(analyzeStyle('коротко').ok, false);
});

test('HH: кадровое агентство получает низкую оценку, собственник — высокую', () => {
  const agency = scoreVacancy(normalizeVacancy(MOCK_VACANCIES.find(v => v.employer.name.includes('Кадровое'))));
  const owner = scoreVacancy(normalizeVacancy(MOCK_VACANCIES[0]));
  assert.ok(agency.score < 20, 'агентство: ' + agency.score);
  assert.ok(owner.score >= 70, 'собственник: ' + owner.score);
});

test('генератор: все заходы дают письмо без незаполненных переменных и с хорошим качеством', () => {
  const lead = { id: 'x', ...vacancyToLead(MOCK_VACANCIES[0]), owner: { name: 'Орлов Дмитрий Сергеевич', social: {} }, contacts: {} };
  lead.owner.posts = ['Самая большая ошибка собственника — думать, что сильный продажник решит все проблемы. Решает система.'];
  for (const hook of ['vacancy', 'facts', 'inaction', 'system', 'case', 'post']) {
    const d = draftMessage({ lead, hook, channel: 'email' });
    assert.doesNotMatch(d.body + d.subject, /\{\w+\}|undefined|NaN/, hook);
    const q = checkMessage({ subject: d.subject, body: d.body, channel: 'email', lead });
    assert.ok(q.score >= 80, `${hook}: ${q.score} ${JSON.stringify(q.issues)}`);
    assert.match(d.body, /Дмитрий Сергеевич/);
  }
});

test('качество: рекламное письмо без личных деталей получает низкую оценку', () => {
  const q = checkMessage({ subject: 'АКЦИЯ!!!', body: 'Уважаемый партнёр! Наша компания рада предложить уникальное предложение. Только сегодня скидка!!! https://a.ru https://b.ru', channel: 'email', lead: { company: 'Ромашка' } });
  assert.ok(q.score < 40, String(q.score));
  assert.equal(q.ok, false);
});

test('классификация ответов', () => {
  assert.equal(classifyReply('Да, актуально, давайте созвонимся в четверг'), 'positive');
  assert.equal(classifyReply('Сколько стоит ваш аудит?'), 'price');
  assert.equal(classifyReply('Не пишите мне больше'), 'unsubscribe');
  assert.equal(classifyReply('Спасибо, не интересно'), 'negative');
  assert.equal(classifyReply('Напишите через месяц'), 'later');
  assert.equal(classifyReply('У нас уже есть свой РОП'), 'have_contractor');
});

test('A/B: явный победитель определяется, интервалы корректны', () => {
  const r = evaluate([{ id: 'A', n: 100, k: 5 }, { id: 'B', n: 100, k: 25 }]);
  assert.equal(r.winner, 'B');
  const [lo, hi] = wilson(25, 100);
  assert.ok(lo > 15 && hi < 36);
  const r2 = evaluate([{ id: 'A', n: 10, k: 1 }, { id: 'B', n: 10, k: 2 }]);
  assert.equal(r2.winner, null);
});

test('разбор звонка демо-встречи', () => {
  const a = analyzeCall(MOCK_TRANSCRIPT);
  assert.equal(a.ok, true);
  assert.equal(a.me, 'Влад');
  assert.ok(a.myQuestions >= 10);
  assert.ok(a.nextStep && a.closeAsked);
  assert.ok(a.objections.some(o => o.id === 'price' && o.handled));
  assert.ok(a.talkRatio > 55, 'в демо Влад говорит много — система должна это заметить');
  assert.ok(a.recommendations.some(r => r.includes('говорили')));
});

test('экономика: воронка и окупаемость', () => {
  const m = funnelModel({ signalsPerMonth: 600 });
  assert.ok(m.deals > 0 && m.revenueRub > m.costRub);
  const p = payback({ investRub: 300000, monthlyGainRub: 400000, monthlyCostRub: 36000, months: 12 });
  assert.equal(p.paybackMonths, 0.8);
  assert.equal(paymentPlan(300000, 'two').totalRub, 315000);
});

test('исследование: парсинг сайта и канала', () => {
  const s = parseSite(MOCK_SITES['https://technoservice-pro.example'], 'https://technoservice-pro.example');
  assert.ok(s.emails.includes('d.orlov@technoservice-pro.example'));
  assert.ok(s.social.telegram?.[0].includes('orlov_business'));
  assert.ok(s.facts.some(f => f.text.includes('2014')));
  const ch = parseTelegramChannel(MOCK_TELEGRAM.orlov_business);
  assert.equal(ch.posts.length, 4);
});

test('сквозная демо-воронка через API: от вакансии до сделки 300 000 ₽', async () => {
  const store = new MemStore();
  const ws = store.createWorkspace({ name: 't', credits: 5000 });
  const ctx = { store, ws, user: { id: 'u' }, role: 'owner', services: mockServices(), demo: true };
  const r = await seedDemo(ctx);
  const { lead, messages, calls, deals, meetings } = await handle(ctx, 'GET', '/leads/' + r.dmitryId);
  assert.equal(lead.stage, 'won');
  assert.ok(lead.owner.style?.ok);
  assert.ok(messages.some(m => m.direction === 'out' && m.status === 'sent'));
  assert.ok(messages.some(m => m.direction === 'in' && m.kind === 'positive'));
  assert.equal(meetings[0].status, 'done');
  assert.ok(calls[0].analysis.score > 0);
  assert.equal(deals[0].amountRub, 300000);
  assert.equal(deals[0].status, 'won');
  const a = await handle(ctx, 'GET', '/analytics');
  assert.ok(a.revenueRub >= 300000);
  // кредиты списались за исследование и письма
  assert.ok(store.getWorkspace(ws.id).credits < 5000);
});

test('права: наблюдатель не видит лидов и не может писать', async () => {
  const store = new MemStore();
  const ws = store.createWorkspace({ name: 't', credits: 100 });
  const ctx = { store, ws, user: { id: 'u' }, role: 'observer', services: mockServices() };
  await assert.rejects(handle(ctx, 'GET', '/leads'), /прав/);
  await assert.rejects(handle(ctx, 'POST', '/leads', { company: 'X' }), /прав/);
  const inv = await handle(ctx, 'GET', '/investors');
  assert.ok(Array.isArray(inv.funnel));
});

test('отписка блокирует отправку', async () => {
  const store = new MemStore();
  const ws = store.createWorkspace({ name: 't', credits: 100 });
  const ctx = { store, ws, user: { id: 'u' }, role: 'owner', services: mockServices() };
  const lead = await handle(ctx, 'POST', '/leads', { company: 'Ромашка', owner: { name: 'Иван' } });
  await handle(ctx, 'POST', `/leads/${lead.id}/reply`, { text: 'Не пишите мне больше' });
  await assert.rejects(handle(ctx, 'POST', `/leads/${lead.id}/messages`, { body: 'привет' }), /не писать/);
});

test('нехватка кредитов останавливает платные действия', async () => {
  const store = new MemStore();
  const ws = store.createWorkspace({ name: 't', credits: 0 });
  const ctx = { store, ws, user: { id: 'u' }, role: 'owner', services: mockServices() };
  const lead = await handle(ctx, 'POST', '/leads', { company: 'Ромашка' });
  await assert.rejects(handle(ctx, 'POST', `/leads/${lead.id}/draft`, {}), /кредит/);
});
