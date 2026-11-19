// Источники клиентов, «Харви: почта», валюты рынков, рефералка, заказы, плашки настройки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemStore } from '../core/memStore.js';
import { mockServices } from '../core/seed.js';
import { handle, growth } from '../core/router.js';
import { preSendGate, nextSendTime, emailGuesses } from '../core/harvey.js';
import { convert, priceInMarkets, ratesFromCbr } from '../core/currency.js';
import { normalizeVacancy } from '../core/hhSignals.js';

const mk = (credits = 500) => { const store = new MemStore(); const ws = store.createWorkspace({ name: 't', credits }); return { store, ws, user: { id: 'u' }, role: 'owner', services: mockServices(), demo: true }; };

test('валюты: пересчёт, таблица рынков, разбор ответа ЦБ, зарплата в тенге → рубли', () => {
  assert.equal(Math.round(convert(92000, 'USD', { USD: 92 })), 1000);
  assert.ok(priceInMarkets(250000, ['VND', 'CNY'])[0].text.endsWith('₫'));
  assert.equal(ratesFromCbr({ Valute: { KZT: { Value: 18, Nominal: 100 } } }).KZT, 0.18);
  const v = normalizeVacancy({ id: '1', name: 'РОП', salary: { from: 1000000, currency: 'KZT' }, employer: { name: 'X' } });
  assert.ok(v.salaryRub > 100000 && v.salaryRub < 400000, String(v.salaryRub));
});

test('Харви: фильтр перед отправкой ловит ссылки, шаблоны, отсутствие отписки', () => {
  assert.equal(preSendGate({ to: 'a@b.ru', subject: 'тема', body: 'Привет. Если не актуально — больше не напишу.' }).ok, true);
  const bad = preSendGate({ to: 'a@b', subject: 'x', body: 'Кликните https://a.ru https://b.ru {{name}}' });
  assert.ok(bad.reasons.length >= 4);
  const t = nextSendTime(new Date('2026-11-07T12:00:00Z'), 'Asia/Ho_Chi_Minh'); // суббота → понедельник
  assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short' }).format(t), 'Mon');
  assert.ok(emailGuesses('Орлов Дмитрий', 'https://x.example').includes('dmitriy.orlov@x.example'));
});

test('источники → когорта Харви → 2 письма → одобрение → второе письмо отменяется при ответе', async () => {
  const ctx = mk();
  const s = await handle(ctx, 'POST', '/sources/search', { source: 'twogis' });
  assert.equal(s.kind, 'org');
  const imp = await handle(ctx, 'POST', '/sources/import', { source: 'twogis', kind: 'org', items: s.items.map(i => i.raw) });
  assert.ok(imp.created >= 5);
  assert.equal((await handle(ctx, 'POST', '/sources/import', { source: 'twogis', kind: 'org', items: s.items.map(i => i.raw) })).created, 0, 'без дублей');
  await handle(ctx, 'PUT', '/harvey', { signals: ['MULTI_BRANCH', 'LOW_RATING'] });
  const L = await handle(ctx, 'POST', '/harvey/launch', { limit: 10 });
  assert.ok(L.created >= 3); assert.equal(L.noMx, 1);
  const msgs = (await ctx.store.list(ctx.ws.id, 'messages')).filter(m => m.approach === 'harvey');
  assert.equal(msgs.filter(m => m.step === 2 && m.status === 'scheduled').length, msgs.filter(m => m.step === 1).length);
  await handle(ctx, 'POST', '/harvey/approve', {});
  const first = (await ctx.store.list(ctx.ws.id, 'messages')).find(m => m.step === 1 && m.status === 'queued');
  await handle(ctx, 'POST', `/messages/${first.id}/send`, { now: true });
  await handle(ctx, 'POST', `/leads/${first.leadId}/reply`, { text: 'Давайте созвонимся в четверг' });
  await growth.harveyTick(ctx, Date.now() + 30 * 86400000);
  const second = (await ctx.store.list(ctx.ws.id, 'messages')).find(m => m.seq === first.seq && m.step === 2);
  assert.equal(second.status, 'skipped');
  const h = await handle(ctx, 'GET', '/hypotheses');
  assert.ok(h.rows.find(r => r.id === 'harvey').replies >= 1);
});

test('рефералка, заказы, плашки; наблюдатель не видит заказы', async () => {
  const ctx = mk();
  const r = await handle(ctx, 'GET', '/referral');
  assert.match(r.code, /^[A-Z0-9]{4,12}$/);
  await assert.rejects(handle(ctx, 'POST', '/orders', { kind: 'нет' }), /Выберите/);
  assert.equal((await handle(ctx, 'POST', '/orders', { kind: 'replace_rop', contact: '@x' })).ok, true);
  await assert.rejects(handle({ ...ctx, role: 'observer' }, 'GET', '/orders'), /прав/);
  const s1 = await handle(ctx, 'GET', '/setup');
  await handle(ctx, 'POST', '/setup/dismiss', { id: s1.items[0].id });
  assert.equal((await handle(ctx, 'GET', '/setup')).items.length, s1.items.length - 1);
});
