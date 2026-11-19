// Пульт, Поиск лидов, Лиды, Карточка лида (исследование, стиль, письмо, ответы, встреча, сделка).
import { S, call, act, go, leadHash, scriptHash, stageName, hookName, offers, refreshBoot } from './state.js';
import { esc, icon, money, usd, toast, modal, hint, copy, fmtDate, ago, formData, scoreRing, pct, $, $$ } from './ui.js';
import { checkMessage } from '../core/quality.js';
import { safeUrl } from '../core/util.js';
import { playbookCard, crmCard, bindCrm, autopilotCard, bindAutopilot } from './views-flow.js';

const stagePill = (st) => `<span class="pill st-${st}">${esc(stageName(st))}</span>`;
const CHANNEL_NAMES = { email: 'Email', telegram: 'Telegram', whatsapp: 'WhatsApp', zalo: 'Zalo', hh_chat: 'Чат hh.ru' };

// ====================== ПУЛЬТ ======================
// Одно главное дело на сейчас и деньги на кону: по открытым сделкам — их сумма, по остальным — средний чек × вероятность этапа.
const STAGE_WIN = { 1: 0.03, 2: 0.08, 3: 0.12, 4: 0.4, 5: 0.3 }; // исследовать, написать, дожать, скрипт, назначить встречу

export async function viewDashboard(el) {
  const [a, leads, meetings, exps, deals] = await Promise.all([call('GET', '/analytics'), call('GET', '/leads'), call('GET', '/meetings'), call('GET', '/experiments'), call('GET', '/deals').catch(() => [])]);
  const now = Date.now();
  const todo = [];
  for (const l of leads.filter(l => l.stage === 'new').slice(0, 3)) todo.push({ ic: 'search', t: `Исследовать «${l.company}»`, d: `Откуда: ${l.vacancy?.title || l.source}. Оценка ${l.score}.`, href: leadHash(l.id), btn: 'Исследовать', lid: l.id, pr: 1 });
  for (const l of leads.filter(l => l.stage === 'researched').slice(0, 3)) todo.push({ ic: 'mail', t: `Написать ${l.owner?.name || 'собственнику'} · ${l.company}`, d: `${l.factsCount ?? l.facts?.length ?? 0} фактов собрано${l.owner?.style?.ok ? ', стиль собственника известен' : ''}.`, href: leadHash(l.id), btn: 'Написать', lid: l.id, pr: 2 });
  for (const l of leads.filter(l => l.stage === 'replied' && !l.demo).slice(0, 3)) todo.push({ ic: 'calendar', t: `Назначить встречу: ${l.owner?.name || l.company}`, d: `Ответ: «${(l.lastReply?.text || '').slice(0, 80)}»`, href: leadHash(l.id), btn: 'Назначить', warn: true, lid: l.id, pr: 5 });
  for (const m of meetings.filter(m => m.status === 'scheduled').slice(0, 3)) todo.push({ ic: 'file', t: `Встреча ${fmtDate(m.at)} — ${m.lead?.owner || m.lead?.company || ''}`, d: 'Откройте персональный скрипт перед звонком.', href: scriptHash(m.leadId), btn: 'Скрипт', lid: m.leadId, pr: 4 });
  for (const l of leads.filter(l => l.stage === 'contacted' && !l.demo && l.lastTouchAt && now - new Date(l.lastTouchAt) > 3 * 86400000).slice(0, 3)) todo.push({ ic: 'clock', t: `Дожать: ${l.company}`, d: `Без ответа ${ago(l.lastTouchAt)} — отправьте короткий дожим.`, href: leadHash(l.id), btn: 'Дожим', lid: l.id, pr: 3 });
  const avg = a.actual?.avgCheckRub || 200000;
  const open = new Map((Array.isArray(deals) ? deals : []).filter(d => d.status === 'open').map(d => [d.leadId, d.amountRub]));
  for (const t of todo) { const x = open.get(t.lid); t.real = x != null; t.rub = t.real ? x : Math.round(avg * (STAGE_WIN[t.pr] || 0.05) / 1e4) * 1e4; }
  todo.sort((x, y) => y.pr - x.pr || y.rub - x.rub);
  const first = todo[0];
  const stake = todo.reduce((s, t) => s + t.rub, 0);
  const leader = exps.find(e => e.status === 'running');
  const f = a.funnel; const top = Math.max(1, f[0].n);
  el.innerHTML = `
    <div class="page-head"><div><h1>Пульт</h1><p>Одно главное дело на сейчас. Остальное — ниже, если нужно.</p></div>
      <div class="row"><a class="btn" href="#queue">${icon('send')}Конвейер</a><a class="btn primary" href="#signals" data-tour="find-signals">${icon('radar')}Найти собственников</a></div></div>
    <div id="setup-box"></div>
    ${first ? `<div class="card hero-todo" data-tour="todo">
      <span class="label">Следующее действие, которое принесёт деньги</span>
      <div class="hero-row">
        <span class="ico big ${first.warn ? 'warn' : ''}">${icon(first.ic)}</span>
        <div class="body"><div class="hero-title">${esc(first.t)}</div><div class="mute">${esc(first.d)}</div></div>
        <div class="hero-sum"><div class="xs mute">в игре${first.real ? '' : ' (оценка)'}</div><b>${money(first.rub, { usd: false })}</b><span class="xs mute">${usd(first.rub)}</span></div>
      </div>
      <a class="btn primary hero-btn" href="${first.href}">Сделать сейчас →</a></div>`
    : '<div class="card" data-tour="todo"><div class="empty">Все дела выполнены. Найдите новых собственников: hh.ru, карты, другие площадки.</div></div>'}
    <div class="grid g3" data-tour="kpis">
      <div class="card kpi"><span class="label">Денег на кону сегодня ${hint('Сумма по всем делам в очереди: по открытым сделкам — их сумма, по остальным — оценка (средний чек × вероятность этапа).')}</span><b>${money(stake, { usd: false })}</b><span class="usd">${usd(stake)} · ${todo.length} дел в очереди</span></div>
      <div class="card kpi"><span class="label">Уже в работе</span><b>${money(a.pipelineRub, { usd: false })}</b><span class="usd">${usd(a.pipelineRub)} · открытые сделки</span></div>
      <div class="card kpi"><span class="label">Заработано</span><b>${money(a.revenueRub, { usd: false })}</b><span class="usd">${usd(a.revenueRub)} · встреч назначено: ${a.meetingsScheduled}</span></div>
    </div>
    ${todo.length > 1 ? `<div class="card"><div class="card-head"><h3>Дальше по очереди</h3></div>
      <div class="list">${todo.slice(1, 6).map(t => `<div class="item"><span class="ico ${t.warn ? 'warn' : ''}">${icon(t.ic)}</span><div class="body"><div class="title">${esc(t.t)}</div><div class="small mute">${esc(t.d)}</div></div><span class="small num mute">${money(t.rub, { usd: false })}</span><a class="btn sm" href="${t.href}">${t.btn}</a></div>`).join('')}</div></div>` : ''}
    <details class="more" data-tour="funnel"><summary>Подробная аналитика: воронка, автопилот, A/B</summary>
      <div class="stack">
        <div class="card"><div class="card-head"><h3>Воронка</h3><span class="xs mute">конверсия из предыдущего этапа</span></div>
          <div class="funnel">${f.map((s, i) => `<div class="funnel-row st-${s.stage}"><span>${esc(s.name)}</span><div class="track"><i style="width:${(s.n / top) * 100}%"></i></div><b>${s.n}</b><span class="conv">${i ? pct(f[i - 1].n ? (s.n / f[i - 1].n) * 100 : 0) : ''}</span></div>`).join('')}</div>
          <p class="xs mute">Лид → встреча: ${pct(a.conversion.leadToMeeting)} · ответы на касание: ${pct(a.conversion.contactToReply)} · встреча → сделка: ${pct(a.conversion.meetingToDeal)}</p></div>
        <div id="ap-box"></div>
        ${leader ? `<div class="card"><div class="card-head"><h3>A/B: ${esc(leader.name)}</h3><a class="btn sm ghost" href="#experiments">Подробнее</a></div>
          <div class="list">${leader.stats.rows.map(r => `<div class="item"><div class="body"><div class="title">${esc(r.name)} <span class="mute small">· ${esc(hookName(r.hook))}</span></div><div class="bar ${r.id === leader.stats.leader ? 'ok' : ''}" style="margin-top:6px"><i style="width:${r.pBest}%"></i></div></div><div class="small num" style="text-align:right">${pct(r.rate)}<br><span class="mute xs">лучший с P=${pct(r.pBest)}</span></div></div>`).join('')}</div>
          <p class="xs mute">${leader.stats.winner ? 'Победитель определён — масштабируйте этот заход.' : `Нужно ещё ${leader.stats.moreTouchesNeeded} касаний на вариант для уверенного вывода.`}</p></div>` : ''}
      </div></details>
    ${hireCard()}`;
  bindHire(el);
  if (S.boot.role === 'owner') {
    const box = $('#ap-box'); box.innerHTML = await autopilotCard(); bindAutopilot(box);
    await setupBanners($('#setup-box'));
  }
}

/** Плашки «что подключить»: коротко, со ссылкой на раздел, закрываются крестиком навсегда. */
async function setupBanners(box) {
  const r = await call('GET', '/setup').catch(() => null);
  if (!r || !r.items.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="banners">${r.items.slice(0, 3).map(i => `<div class="banner" data-id="${esc(i.id)}"><div><b>${esc(i.title)}</b><span class="small mute">${esc(i.text)}</span></div><a class="btn sm" href="#${esc(i.view)}">Подключить</a><button class="btn sm ghost" data-dismiss="${esc(i.id)}" aria-label="Скрыть">✕</button></div>`).join('')}
    <div class="xs mute">Готово ${r.done} из ${r.total}${r.items.length > 3 ? ` · ещё ${r.items.length - 3}` : ''} · <button class="linklike" data-dismiss="*">скрыть все</button></div></div>`;
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-dismiss]'); if (!b) return;
    await act(() => call('POST', '/setup/dismiss', { id: b.dataset.dismiss }));
    await setupBanners(box);
  }, { once: true });
}

/** Внизу пульта: заказать человека и стать агентом — в два касания. */
export function hireCard() {
  return `<div class="card hire" data-tour="hire"><div class="card-head"><h3>Нужны люди или партнёрство?</h3></div>
    <div class="hire-grid">
      <button class="btn" data-order="hire_sales">${icon('users')}Нанять продажника</button>
      <button class="btn" data-order="hire_rop">${icon('users')}Нанять РОПа</button>
      <button class="btn" data-order="replace_rop">${icon('users')}Заменить РОПа</button>
      <button class="btn primary" data-agent>${icon('spark')}Стать агентом</button>
    </div></div>`;
}
const ORDER_TEXT = { hire_sales: ['Нанять продажника', 'Подберём и введём в работу менеджера по продажам под ваш план.'], hire_rop: ['Нанять РОПа', 'Найдём руководителя отдела продаж, который построит систему без вас.'], replace_rop: ['Заменить РОПа', 'Аудит текущего РОПа и замена без провала плана.'] };
export function bindHire(root) {
  root.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => {
    const [title, text] = ORDER_TEXT[b.dataset.order];
    const m = modal(`<h2>${esc(title)}</h2><p class="mute">${esc(text)}</p>
      <form id="order-f" class="stack"><label class="field"><span>Как с вами связаться</span><input name="contact" required placeholder="Telegram, телефон или email" value="${esc(S.boot.user?.email || '')}"></label>
      <label class="field"><span>Что важно (необязательно)</span><textarea name="details" rows="3" placeholder="Ниша, город, план продаж, сроки"></textarea></label>
      <div class="row"><button class="btn primary">Отправить заявку</button><button class="btn ghost" type="button" data-close>Отмена</button></div></form>`);
    m.el.querySelector('#order-f').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); const r = await act(() => call('POST', '/orders', { kind: b.dataset.order, contact: f.contact, details: f.details })); if (r) { toast(r.text); m.close(); } });
  }));
  root.querySelector('[data-agent]')?.addEventListener('click', async () => {
    const r = await act(() => call('GET', '/referral')); if (!r) return;
    const link = (S.boot.baseUrl || (S.api.mode === 'server' ? location.origin : 'https://ваш-домен.ru')) + r.path; // в демо домена нет
    const m = modal(`<h2>Стать агентом</h2><p>Рекомендуйте LEADMEET OS собственникам и агентствам — получайте <b>${r.percent}%</b> с каждой их оплаты.</p>
      <label class="field"><span>Ваша ссылка</span><input readonly value="${esc(link)}"></label>
      <div class="grid g3"><div class="kpi"><span class="label">Пришло</span><b>${r.invited}</b></div><div class="kpi"><span class="label">Оплатили</span><b>${money(r.paidRub, { usd: false })}</b></div><div class="kpi"><span class="label">Ваши</span><b>${money(r.earnedRub, { usd: false })}</b></div></div>
      <div class="row"><button class="btn primary" data-copy>Скопировать ссылку</button><button class="btn ghost" data-close>Закрыть</button></div>`);
    m.el.querySelector('[data-copy]').addEventListener('click', () => copy(link));
  });
}

// ====================== ПОИСК ЛИДОВ ======================
export async function viewSignals(el) {
  const st = S.boot.settings.hh;
  el.innerHTML = `
    <div class="page-head"><div><h1>Поиск лидов на hh.ru</h1><p>Компании, которые ищут топ-позиции, где кандидатов отбирает сам собственник: коммерческий директор, РОП, исполнительный директор, ассистент собственника. Вакансия даёт повод для разговора и показывает, где болит.</p></div></div>
    <form class="card" id="hh-form" data-tour="hh-form">
      <div class="form-grid">
        <label class="field" style="grid-column:1/-1"><span>Должности (по одной в строке) ${hint('Ищем вакансии, на которые кандидатов отбирает первое лицо. Добавьте свои — например «директор по маркетингу» или «CTO» для IT-ниши.')}</span><textarea id="hh-roles" name="roles" rows="3">${esc(st.roles.join('\n'))}</textarea></label>
        <label class="field"><span>Регион (ID hh.ru, пусто — вся Россия) ${hint('1 — Москва, 2 — Санкт-Петербург, 88 — Казань, 3 — Екатеринбург.')}</span><input id="hh-area" name="area" value="${esc(st.area)}" placeholder="1"></label>
        <label class="field"><span>Зарплата от, ₽ ${hint('Отсекает компании, которым чек от 200 000 ₽ будет не по силам.')}</span><input id="hh-salary" name="salaryFrom" type="number" value="${st.salaryFrom}"></label>
        <label class="field"><span>За последние, дней</span><input id="hh-period" name="period" type="number" value="${st.period}"></label>
        <label class="field"><span>Минимальная оценка ${hint('0–100: насколько вероятно, что отбор ведёт собственник и есть бюджет. Ниже порога — скрыто.')}</span><input id="hh-min" name="minScore" type="number" value="${st.minScore}"></label>
        <label class="field"><span>Ниша</span><select id="hh-niche" name="niche">${S.boot.catalog.niches.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button class="btn primary" type="submit">${icon('search')}Найти вакансии</button><span class="xs mute">Официальный API hh.ru. 1 кредит списывается только при исследовании лида.</span></div>
    </form>
    <div id="hh-results"></div>
    <div class="grid g2">
      <form class="card" id="manual-lead"><h3>Добавить лида вручную</h3><p class="small mute">Из чата руководителей, рекомендации, Telegram-канала или с конференции.</p>
        <div class="form-grid"><label class="field"><span>Компания</span><input id="ml-company" name="company" required></label><label class="field"><span>Собственник (ФИО)</span><input id="ml-owner" name="owner"></label>
        <label class="field"><span>Сайт</span><input id="ml-site" name="site" placeholder="https://"></label><label class="field"><span>Telegram собственника</span><input id="ml-tg" name="tg" placeholder="@username"></label>
        <label class="field"><span>Email</span><input id="ml-email" name="email" type="email"></label><label class="field"><span>Источник</span><select id="ml-src" name="source"><option value="tg_chats">Чат руководителей</option><option value="manual">Рекомендация / вручную</option><option value="vk">ВКонтакте</option><option value="event">Мероприятие</option></select></label></div>
        <div><button class="btn" type="submit">${icon('plus')}Добавить</button></div></form>
      <div class="card"><h3>Где ещё брать собственников</h3><ul class="facts">
        <li>Чаты руководителей и собственников в Telegram и VK: вопросы «посоветуйте РОПа», «кто строил отдел продаж».</li>
        <li>Чаты специалистов с высоким чеком: коучи, психологи, стоматологи, IT-студии. Здесь важен личный тон.</li>
        <li>Заявки с рекламы (Директ, VK, TikTok, Instagram) — через вебхук в разделе «Каналы».</li>
        <li>Любой сайт: виджет-форма отправляет заявку сюда с utm-метками.</li></ul>
        <a class="btn sm" href="#channels">Подключить каналы</a></div>
    </div>
    ${crmCard()}`;
  bindCrm(el);
  $('#hh-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = formData(e.target);
    const body = { roles: fd.roles.split('\n').map(s => s.trim()).filter(Boolean), area: fd.area, salaryFrom: fd.salaryFrom, period: fd.period, minScore: fd.minScore, niche: fd.niche };
    $('#hh-results').innerHTML = '<div class="card mute">Ищу вакансии…</div>';
    const r = await act(() => call('POST', '/hh/search', body));
    if (!r) { $('#hh-results').innerHTML = ''; return; }
    renderHhResults(r, body.niche);
  });
  $('#manual-lead').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = formData(e.target);
    const lead = await act(() => call('POST', '/leads', { company: fd.company, site: fd.site, source: fd.source, owner: { name: fd.owner, social: { telegram: fd.tg } }, contacts: { ownerEmail: fd.email, emails: fd.email ? [fd.email] : [] } }), 'Лид добавлен');
    if (lead) go(leadHash(lead.id));
  });
}

function renderHhResults(r, niche) {
  const box = $('#hh-results');
  box.innerHTML = `<div class="card" data-tour="hh-results"><div class="card-head"><h3>Найдено ${r.total}, показано ${r.items.length}${r.hidden ? `, скрыто ниже порога: ${r.hidden}` : ''}</h3>
    <div class="row"><button class="btn sm" id="hh-all">Выбрать все</button><button class="btn sm primary" id="hh-import">Импортировать выбранные</button></div></div>
    ${r.errors?.length ? `<p class="small" style="color:var(--bad)">${r.errors.map(esc).join('<br>')}</p>` : ''}
    <div class="table-wrap"><table><thead><tr><th></th><th>Оценка</th><th>Компания и вакансия</th><th class="n">Доход до</th><th>Почему</th></tr></thead><tbody>
    ${r.items.map((x, i) => `<tr><td><input type="checkbox" id="hh-c${i}" data-i="${i}" ${x.preview.imported ? 'disabled' : 'checked'}></td><td>${scoreRing(x.preview.score)}</td>
      <td><b>${esc(x.preview.company)}</b><br>${safeUrl(x.preview.url) ? `<a href="${esc(safeUrl(x.preview.url))}" target="_blank" rel="noopener">${esc(x.preview.title)}</a>` : esc(x.preview.title)}<div class="xs mute">${esc(x.preview.area || '')}${x.preview.imported ? ' · уже в лидах' : ''}</div></td>
      <td class="n">${x.preview.salary ? money(x.preview.salary) : '—'}</td><td class="small">${x.preview.reasons.slice(0, 3).map(esc).join('<br>')}</td></tr>`).join('') || '<tr><td colspan="5" class="mute">Ничего не найдено — расширьте регион или снизьте порог.</td></tr>'}
    </tbody></table></div></div>`;
  $('#hh-all')?.addEventListener('click', () => $$('#hh-results input[type=checkbox]:not([disabled])').forEach(c => { c.checked = true; }));
  $('#hh-import')?.addEventListener('click', async () => {
    const items = $$('#hh-results input[type=checkbox]:checked').map(c => r.items[+c.dataset.i].raw);
    if (!items.length) return toast('Ничего не выбрано');
    const res = await act(() => call('POST', '/hh/import', { items, niche }));
    if (res) { toast(`Импортировано лидов: ${res.created}`); go('#leads'); }
  });
}

// ====================== ЛИДЫ ======================
export async function viewLeads(el) {
  const stats = await call('GET', '/leads/stats');
  const stages = S.boot.catalog.stages;
  let filter = sessionStorageGet('lm-stage') || 'all', q = '';
  el.innerHTML = `
    <div class="page-head"><div><h1>Лиды</h1><p>Каждый собственник проходит путь: новый лид → исследование → касание → ответ → встреча → сделка. Всего: ${stats.total}.</p></div>
      <div class="row"><input id="lead-q" placeholder="Поиск: компания, имя, вакансия" style="width:260px"><a class="btn primary" href="#signals">${icon('plus')}Найти лидов</a></div></div>
    <div class="stage-strip" id="stage-strip" data-tour="stage-strip">
      ${stages.map(s => `<button data-st="${s.id}" class="st-${s.id}"><span class="pill st-${s.id}" style="border:0;background:none;padding:0">${esc(s.name)}</span><b>${stats.byStage[s.id] || 0}</b></button>`).join('')}
    </div>
    <div class="table-wrap"><table><thead><tr><th>Компания</th><th>Собственник</th><th>Откуда лид</th><th class="n">Оценка</th><th>Этап</th><th>Источник</th></tr></thead><tbody id="lead-rows"></tbody></table></div>
    <p class="xs mute" id="lead-more"></p>`;
  let seq = 0;
  const draw = async () => {
    const my = ++seq;
    $$('#stage-strip button').forEach(b => b.classList.toggle('on', b.dataset.st === filter));
    const params = new URLSearchParams({ limit: '300' });
    if (filter !== 'all') params.set('stage', filter);
    if (q) params.set('q', q);
    const ls = await call('GET', '/leads?' + params);
    if (my !== seq || !$('#lead-rows')) return;
    $('#lead-rows').innerHTML = ls.map(l => `<tr class="click" data-id="${esc(l.id)}"><td><b>${esc(l.company || '—')}</b>${l.demo ? ' <span class="tag">история</span>' : ''}${l.optOut ? ' <span class="tag bad">отписан</span>' : ''}</td><td>${esc(l.owner?.name || '—')}</td><td class="small">${esc(l.vacancy?.title || l.notes?.slice(0, 50) || '—')}</td><td class="n">${l.score ?? ''}</td><td>${stagePill(l.stage)}</td><td class="small mute">${esc(String(l.source || '').replace('inbound:', 'заявка · '))}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">Нет лидов на этом этапе.</div></td></tr>';
    $('#lead-more').textContent = ls.length >= 300 ? 'Показаны 300 лучших по оценке — уточните поиск или этап.' : '';
  };
  let t = null;
  $('#stage-strip').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filter = filter === b.dataset.st ? 'all' : b.dataset.st; sessionStorageSet('lm-stage', filter); draw(); });
  $('#lead-q').addEventListener('input', (e) => { q = e.target.value.toLowerCase(); clearTimeout(t); t = setTimeout(draw, 250); });
  $('#lead-rows').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) go(leadHash(tr.dataset.id)); });
  await draw();
}
function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } }

// ====================== КАРТОЧКА ЛИДА ======================
export async function viewLead(el, id) {
  const { lead, messages, meetings, calls, deals } = await call('GET', '/leads/' + id);
  const exps = await call('GET', '/experiments');
  const st = lead.owner?.style;
  const comp = (S.composer[id] ||= { hook: lead.owner?.posts?.length ? 'post' : 'facts', channel: lead.contacts?.ownerEmail || lead.contacts?.emails?.length ? 'email' : (lead.owner?.social?.telegram ? 'telegram' : 'email'), experimentId: '', draft: null });
  const social = Object.entries(lead.owner?.social || {}).filter(([, v]) => v);
  const sentCount = messages.filter(m => m.direction === 'out' && m.status === 'sent').length;
  el.innerHTML = `
    <div class="page-head"><div><div class="row"><a class="btn ghost sm" href="#leads">← Лиды</a>${stagePill(lead.stage)}${lead.optOut ? '<span class="tag bad">просил не писать</span>' : ''}</div>
      <h1 style="margin-top:8px">${esc(lead.company || 'Без названия')}</h1>
      <p>${esc(lead.owner?.name || 'Собственник не указан')}${lead.owner?.role ? ' · ' + esc(lead.owner.role) : ''}${lead.city ? ' · ' + esc(lead.city) : ''}</p></div>
      <div class="row">
        <button class="btn" id="btn-research" data-tour="research">${icon('search')}Исследовать</button>
        <a class="btn" href="${scriptHash(lead.id)}" data-tour="open-script">${icon('file')}Скрипт встречи</a>
        <button class="btn" id="btn-stage">Сменить этап</button>
      </div></div>
    <div class="split">
      <div class="stack">
        <div class="card" data-tour="profile"><div class="card-head"><h3>Профиль</h3><button class="btn sm ghost" id="btn-edit">Изменить</button></div>
          <div class="small stack" style="gap:6px">
            ${lead.vacancy?.title ? `<div><span class="label">Откуда лид</span><br>${safeUrl(lead.vacancy.url) ? `<a href="${esc(safeUrl(lead.vacancy.url))}" target="_blank" rel="noopener">${esc(lead.vacancy.title)}</a>` : esc(lead.vacancy.title)}${lead.vacancy.salaryRub ? ' · до ' + money(lead.vacancy.salaryRub) : ''}</div>` : ''}
            ${safeUrl(lead.site) ? `<div><span class="label">Сайт</span><br><a href="${esc(safeUrl(lead.site))}" target="_blank" rel="noopener">${esc(lead.site)}</a></div>` : ''}
            <div><span class="label">Контакты</span><br>${[lead.contacts?.ownerEmail, ...(lead.contacts?.emails || []), ...(lead.contacts?.phones || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(esc).join(' · ') || '<span class="mute">нет — добавьте или запустите исследование</span>'}</div>
            ${social.length ? `<div><span class="label">Соцсети</span><br>${social.map(([k, v]) => `<span class="tag">${esc(k)}: ${esc(String(v).replace(/^https?:\/\//, ''))}</span>`).join(' ')}</div>` : ''}
            ${lead.scoreReasons?.length ? `<div><span class="label">Оценка ${lead.score}</span><br>${lead.scoreReasons.slice(0, 4).map(esc).join('<br>')}</div>` : ''}
          </div></div>
        <div class="card" data-tour="facts"><div class="card-head"><h3>Что я уже знаю о компании</h3>${hint('Факты из открытых источников с указанием источника. Генератор пишет только то, что здесь есть, и ничего не выдумывает.')}</div>
          ${lead.facts?.length ? `<ul class="facts">${lead.facts.map(f => `<li><span>${esc(f.text)}${/^https?:/i.test(f.source || '') && safeUrl(f.source) ? ` <a class="xs" href="${esc(safeUrl(f.source))}" target="_blank" rel="noopener">источник</a>` : ''}</span></li>`).join('')}</ul>` : '<p class="mute small">Фактов пока нет. Нажмите «Исследовать»: система прочитает сайт и публичный Telegram-канал собственника.</p>'}
          <div><span class="label">Гипотезы боли</span><ul class="facts" style="margin-top:6px">${(lead.hypotheses || []).map(h => `<li>${esc(h.pain)} <span class="tag brand">${esc(offers().find(o => o.id === h.offerId)?.name || h.offerId)}</span></li>`).join('')}</ul></div>
          ${lead.inaction ? `<div class="small"><span class="label">Цена бездействия (оценка)</span><br>${money(lead.inaction.lostPerMonthRub)} в месяц недобора · ошибка найма ≈ ${money(lead.inaction.badHireRiskRub)}</div>` : ''}
        </div>
        <div class="card" data-tour="style"><div class="card-head"><h3>Как пишет собственник</h3>${hint('Вставьте 3–5 его постов или сообщений. Система определит обращение (ты/вы), длину фраз, эмодзи, любимые слова, и письмо зазвучит на его языке.')}</div>
          ${st?.ok ? `<p class="small"><b>${esc(st.summary)}</b></p><div class="chips">${(st.topWords || []).slice(0, 8).map(w => `<span class="tag">${esc(w.w)}</span>`).join('')}${(st.topEmojis || []).map(e => `<span class="tag">${esc(e)}</span>`).join('')}</div>` : '<p class="small mute">Стиль ещё не определён.</p>'}
          <details><summary>Вставить посты вручную</summary><textarea id="style-text" rows="5" placeholder="Скопируйте сюда 3–5 постов из его канала, VK или LinkedIn">${esc((lead.owner?.posts || []).join('\n\n'))}</textarea><div style="margin-top:8px"><button class="btn sm" id="btn-style">Определить стиль</button></div></details>
        </div>
      </div>
      <div class="stack">
        <div class="card" id="composer" data-tour="composer"><div class="card-head"><h3>Первое касание</h3><span class="xs mute">${sentCount ? `отправлено: ${sentCount}` : 'ещё не писали'}</span></div>
          <div class="field"><span>Заход ${hint('Каждый заход — своя гипотеза. Запустите A/B, чтобы система сама выбирала лучший.')}</span><div class="chips" id="hooks">${S.boot.catalog.hooks.map(h => `<button type="button" class="chip ${comp.hook === h.id ? 'on' : ''}" data-hook="${h.id}" title="${esc(h.idea)}">${esc(h.name)}</button>`).join('')}</div></div>
          <div class="form-grid">
            <label class="field"><span>Канал</span><select id="c-channel">${Object.entries(CHANNEL_NAMES).map(([k, v]) => `<option value="${k}" ${comp.channel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="field"><span>A/B-эксперимент ${hint('Если выбран, вариант захода подберёт алгоритм Thompson sampling, и ответ засчитается в статистику.')}</span><select id="c-exp"><option value="">— без эксперимента —</option>${exps.filter(x => x.status === 'running').map(x => `<option value="${x.id}" ${comp.experimentId === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          </div>
          <div class="row"><button class="btn primary" id="btn-draft" data-tour="draft">${icon('spark')}Написать черновик</button>
            <label class="switch"><input type="checkbox" id="c-llm" ${S.boot.llm ? 'checked' : 'disabled'}> Claude${S.boot.llm ? '' : ' (подключите в Каналах)'}</label>
            ${sentCount ? '<button class="btn sm" id="btn-fu1">Дожим №1</button><button class="btn sm" id="btn-fu2">Дожим №2</button>' : ''}</div>
          <div id="draft-box"></div>
        </div>
        <div id="pb-box">${lead.vacancy?.title || lead.source === 'hh' ? '<div class="card mute small">Загружаю HH-плейбук…</div>' : ''}</div>
        <div class="card" data-tour="reply"><div class="card-head"><h3>Пришёл ответ</h3>${hint('Вставьте ответ собственника. Система определит тип (готов к встрече, вопрос, цена, позже, отказ) и подскажет ответ. Отписка блокирует дальнейшие касания.')}</div>
          <textarea id="reply-text" rows="3" placeholder="Например: «Да, актуально. Давайте в четверг в 11:00?»"></textarea>
          <div class="row"><button class="btn" id="btn-reply">Разобрать ответ</button></div><div id="reply-box"></div></div>
        <div class="card" data-tour="meeting"><div class="card-head"><h3>Встреча и сделка</h3></div>
          <div class="form-grid"><label class="field"><span>Дата и время встречи</span><input type="datetime-local" id="mt-at" value="${localDT(Date.now() + 86400000)}"></label><label class="field"><span>Ссылка на звонок</span><input id="mt-link" placeholder="Zoom / Телемост / МТС Линк"></label></div>
          <div class="row"><button class="btn" id="btn-meet">${icon('calendar')}Назначить встречу</button><button class="btn" id="btn-call">${icon('mic')}Загрузить запись звонка</button><button class="btn" id="btn-deal">Оформить сделку</button></div>
        </div>
        <div class="card"><h3>История</h3><div class="timeline">${timeline(messages, meetings, calls, deals)}</div></div>
      </div>
    </div>`;

  // --- handlers
  $('#btn-research').addEventListener('click', async () => {
    const r = await act(() => call('POST', `/leads/${id}/research`, {}));
    if (r) { toast(r.log.join(' · ') || 'Исследование завершено'); S.render(); }
  });
  $('#btn-style').addEventListener('click', async () => { const r = await act(() => call('POST', `/leads/${id}/style`, { text: $('#style-text').value })); if (r) { toast('Стиль: ' + r.style.summary); S.render(); } });
  $('#btn-stage').addEventListener('click', () => stageModal(lead));
  $('#btn-edit').addEventListener('click', () => editLeadModal(lead));
  $('#hooks').addEventListener('click', (e) => { const b = e.target.closest('[data-hook]'); if (!b) return; comp.hook = b.dataset.hook; $$('#hooks .chip').forEach(c => c.classList.toggle('on', c === b)); });
  $('#c-channel').addEventListener('change', (e) => { comp.channel = e.target.value; });
  $('#c-exp').addEventListener('change', (e) => { comp.experimentId = e.target.value; });
  const draft = async (extra = {}) => {
    const r = await act(() => call('POST', `/leads/${id}/draft`, { hook: comp.hook, channel: comp.channel, experimentId: comp.experimentId || undefined, useLlm: $('#c-llm').checked, ...extra }));
    if (r) { comp.draft = r; drawDraft(lead, comp); updateCredits(); }
  };
  $('#btn-draft').addEventListener('click', () => draft());
  $('#btn-fu1')?.addEventListener('click', () => draft({ followUp: 1 }));
  $('#btn-fu2')?.addEventListener('click', () => draft({ followUp: 2 }));
  if (comp.draft) drawDraft(lead, comp);
  $('#btn-reply').addEventListener('click', async () => {
    const text = $('#reply-text').value.trim(); if (!text) return toast('Вставьте текст ответа');
    const r = await act(() => call('POST', `/leads/${id}/reply`, { text, channel: comp.channel }));
    if (!r) return;
    const names = { positive: 'Готов к встрече', question: 'Вопрос', price: 'Спрашивает цену', later: 'Позже', have_contractor: 'Уже есть подрядчик', negative: 'Отказ', unsubscribe: 'Просит не писать' };
    $('#reply-box').innerHTML = `<div class="msg in"><div class="meta"><span class="tag ${['negative', 'unsubscribe'].includes(r.kind) ? 'bad' : 'ok'}">${names[r.kind] || r.kind}</span></div>${r.suggestion ? `<b>Подсказка ответа:</b>\n${esc(r.suggestion)}` : 'Контакт помечен — больше не пишем.'}</div>${r.suggestion ? `<div class="row"><button class="btn sm" id="copy-sugg">${icon('copy')}Скопировать</button>${r.kind === 'positive' ? '<span class="small mute">Назначьте встречу ниже ↓</span>' : ''}</div>` : ''}`;
    $('#copy-sugg')?.addEventListener('click', () => copy(r.suggestion));
    toast('Ответ сохранён, этап обновлён');
  });
  $('#btn-meet').addEventListener('click', async () => {
    const at = new Date($('#mt-at').value).toISOString();
    const r = await act(() => call('POST', `/leads/${id}/meeting`, { at, link: $('#mt-link').value }), 'Встреча назначена');
    if (r) go(scriptHash(id));
  });
  $('#btn-call').addEventListener('click', () => uploadCallModal({ leadId: id, meetingId: meetings.find(m => m.status === 'scheduled')?.id }));
  $('#btn-deal').addEventListener('click', () => dealModal(lead));
  $$('[data-deal-won]').forEach(b => b.addEventListener('click', async () => { await act(() => call('PUT', '/deals/' + b.dataset.dealWon, { status: 'won' }), 'Сделка выиграна'); S.render(); }));
  if (lead.vacancy?.title || lead.source === 'hh') playbookCard(lead, $('#pb-box')).catch(e => { $('#pb-box').innerHTML = `<div class="card small mute">${esc(e.message)}</div>`; });
}

function updateCredits() { call('GET', '/bootstrap').then(b => { const c = $('#credit-count'); if (c) c.textContent = b.ws.credits; }).catch(() => {}); }

function localDT(ms) { const d = new Date(ms); d.setMinutes(0, 0, 0); d.setHours(Math.max(10, Math.min(17, d.getHours()))); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`; }

function drawDraft(lead, comp) {
  const d = comp.draft;
  const box = $('#draft-box');
  const isEmail = d.channel === 'email';
  box.innerHTML = `<div class="stack">
    ${d.llmError ? `<p class="small" style="color:var(--warn)">Claude недоступен: ${esc(d.llmError)}. Показан шаблонный вариант.</p>` : ''}
    <div class="row xs mute">${d.usedLlm ? '<span class="tag ok">улучшено Claude</span>' : '<span class="tag">шаблон</span>'}<span>заход: ${esc(hookName(d.hook))}</span>${d.variantId ? `<span class="tag brand">вариант ${esc(d.variantId)}</span>` : ''}</div>
    ${isEmail ? `<label class="field"><span>Кому</span><input id="d-to" value="${esc(lead.contacts?.ownerEmail || lead.contacts?.emails?.[0] || '')}" placeholder="email собственника"></label><label class="field"><span>Тема</span><input id="d-subject" value="${esc(d.subject)}"></label>` : `<label class="field"><span>Кому</span><input id="d-to" value="${esc(d.channel === 'telegram' ? (lead.owner?.social?.telegram || '') : d.channel === 'hh_chat' ? (lead.vacancy?.url || '') : (lead.contacts?.phones?.[0] || ''))}" placeholder="${d.channel === 'telegram' ? '@username' : 'номер или ссылка'}"></label>`}
    <label class="field"><span>Текст (можно править)</span><textarea id="d-body" class="tall">${esc(d.body)}</textarea></label>
    <div class="row between" data-tour="quality"><div class="row">${scoreRing(d.quality.score)}<div class="small"><b>Качество касания</b><br><span class="mute" id="q-words">${d.quality.words} слов</span></div>${hint('Проверка как у живого человека: есть личная деталь, один вопрос в конце, нет рекламных слов, не больше одной ссылки, есть фраза-отписка. Чем выше оценка, тем ниже риск спама.')}</div></div>
    <ul class="issues" id="q-issues">${d.quality.issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') || '<li>Замечаний нет.</li>'}</ul>
    <div class="row" data-tour="send">
      ${isEmail ? `<button class="btn primary" data-send="queue">${icon('send')}В очередь отправки</button><button class="btn" data-send="now">Отправить сейчас</button>` : `<button class="btn primary" data-send="manual">${icon('send')}Скопировать и открыть ${esc(CHANNEL_NAMES[d.channel])}</button>`}
      <button class="btn" data-send="draft">Сохранить черновик</button>
      <button class="btn ghost" id="d-copy">${icon('copy')}Копировать</button>
    </div>
    <p class="xs mute">${isEmail ? 'Очередь отправляет письма в рабочее окно, с паузой между ними и дневным лимитом прогрева (раздел «Настройки»).' : 'Отправка с вашего личного аккаунта: текст копируется, чат открывается в новой вкладке. Без ботов и массовых рассылок, поэтому аккаунт не банят.'}</p>
  </div>`;
  const recheck = () => {
    const q = checkMessage({ subject: $('#d-subject')?.value || '', body: $('#d-body').value, channel: d.channel, lead });
    $('#q-words').textContent = q.words + ' слов';
    box.querySelector('.score').outerHTML = scoreRing(q.score);
    $('#q-issues').innerHTML = q.issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') || '<li>Замечаний нет.</li>';
    d.body = $('#d-body').value; d.subject = $('#d-subject')?.value || d.subject;
  };
  $('#d-body').addEventListener('input', recheck);
  $('#d-subject')?.addEventListener('input', recheck);
  $('#d-copy').addEventListener('click', () => copy(($('#d-subject') ? $('#d-subject').value + '\n\n' : '') + $('#d-body').value));
  box.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', async () => {
    const mode = b.dataset.send;
    const body = { subject: $('#d-subject')?.value || '', body: $('#d-body').value, channel: d.channel, hook: d.hook, experimentId: d.experimentId, variantId: d.variantId, to: $('#d-to').value, followUp: /followup(\d)/.test(d.hook) ? +d.hook.slice(-1) : 0, status: mode === 'draft' ? 'draft' : 'approved' };
    if (mode === 'manual') await copy(body.body);
    const msg = await act(() => call('POST', `/leads/${lead.id}/messages`, body));
    if (!msg) return;
    if (mode === 'draft') { toast('Черновик сохранён'); return S.render(); }
    const r = await act(() => call('POST', `/messages/${msg.id}/send`, { now: mode === 'now' || S.api.mode === 'demo', manual: mode === 'manual' }));
    if (!r) return;
    if (mode === 'manual' && r.link) { const a = document.createElement('a'); a.href = r.link; a.target = '_blank'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove(); }
    toast(r.queued ? r.note : mode === 'manual' ? 'Текст скопирован, чат открыт. Касание отмечено.' : 'Отправлено');
    S.composer[lead.id].draft = null;
    S.render();
  }));
}

function timeline(messages, meetings, calls, deals) {
  const ev = [
    ...messages.map(m => ({ at: m.sentAt || m.createdAt, html: `<div class="msg ${m.direction === 'in' ? 'in' : ''}"><div class="meta"><span class="tag ${m.direction === 'in' ? 'brand' : ''}">${m.direction === 'in' ? 'ответ' : esc(CHANNEL_NAMES[m.channel] || m.channel)}</span><span class="tag">${esc({ draft: 'черновик', approved: 'готово', queued: 'в очереди', sent: 'отправлено', received: 'получено', error: 'ошибка' }[m.status] || m.status)}</span>${m.hook ? `<span class="xs mute">${esc(hookName(m.hook))}</span>` : ''}<span class="xs mute">${fmtDate(m.sentAt || m.createdAt)}</span>${m.repliedAt ? '<span class="tag ok">ответил</span>' : ''}</div>${m.subject ? `<b>${esc(m.subject)}</b>\n` : ''}${esc(m.body)}${m.error ? `\n<span style="color:var(--bad)">${esc(m.error)}</span>` : ''}</div>` })),
    ...meetings.map(m => ({ at: m.createdAt, html: `<div class="item"><span class="ico">${icon('calendar')}</span><div class="body"><div class="title">Встреча ${fmtDate(m.at)}</div><div class="small mute">${m.status === 'done' ? 'проведена' : 'назначена'}${m.link ? ' · ' + esc(m.link) : ''}</div></div><a class="btn sm" href="${scriptHash(m.leadId)}">Скрипт</a></div>` })),
    ...calls.map(c => ({ at: c.createdAt, html: `<div class="item"><span class="ico ok">${icon('mic')}</span><div class="body"><div class="title">${esc(c.title)}: оценка ${c.analysis?.score ?? '—'}</div><div class="small mute">Доля речи ${c.analysis?.talkRatio}% · вопросов ${c.analysis?.myQuestions}</div></div><a class="btn sm" href="#calls">Разбор</a></div>` })),
    ...deals.map(d => ({ at: d.createdAt, html: `<div class="item"><span class="ico ${d.status === 'won' ? 'ok' : 'warn'}">${icon('check')}</span><div class="body"><div class="title">Сделка: ${money(d.amountRub)}</div><div class="small mute">${d.items.map(i => esc(i.name) + ' — ' + money(i.priceRub, { usd: false })).join(' + ')} · ${d.status === 'won' ? 'выиграна' : d.status === 'lost' ? 'проиграна' : 'открыта'}${d.paidRub ? ' · оплачено ' + money(d.paidRub, { usd: false }) : ''}</div></div>${d.status === 'open' ? `<button class="btn sm" data-deal-won="${d.id}">Выиграна</button>` : ''}</div>` })),
  ].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return ev.map(e => e.html).join('') || '<p class="mute small">Пока пусто.</p>';
}

function stageModal(lead) {
  modal(`<h3>Этап для «${esc(lead.company)}»</h3><div class="chips">${S.boot.catalog.stages.map(s => `<button class="chip ${lead.stage === s.id ? 'on' : ''}" data-s="${s.id}">${esc(s.name)}</button>`).join('')}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-close>Закрыть</button></div>`, {
    onMount(m, close) { m.addEventListener('click', async (e) => { const b = e.target.closest('[data-s]'); if (!b) return; await act(() => call('PUT', '/leads/' + lead.id, { stage: b.dataset.s }), 'Этап обновлён'); close(); S.render(); }); },
  });
}

function editLeadModal(lead) {
  modal(`<h3>Профиль лида</h3><form id="edit-lead" class="stack">
    <div class="form-grid"><label class="field"><span>Компания</span><input id="e-company" name="company" value="${esc(lead.company)}"></label>
    <label class="field"><span>Собственник (ФИО)</span><input id="e-owner" name="owner" value="${esc(lead.owner?.name || '')}"></label>
    <label class="field"><span>Роль</span><input id="e-role" name="role" value="${esc(lead.owner?.role || '')}"></label>
    <label class="field"><span>Сайт</span><input id="e-site" name="site" value="${esc(lead.site || '')}"></label>
    <label class="field"><span>Email собственника</span><input id="e-email" name="email" value="${esc(lead.contacts?.ownerEmail || '')}"></label>
    <label class="field"><span>Телефон</span><input id="e-phone" name="phone" value="${esc(lead.contacts?.phones?.[0] || '')}"></label>
    <label class="field"><span>Telegram собственника</span><input id="e-tg" name="tg" value="${esc(lead.owner?.social?.telegram || '')}"></label>
    <label class="field"><span>Ниша</span><select id="e-niche" name="industry">${S.boot.catalog.niches.map(n => `<option value="${n.id}" ${lead.industry === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</select></label></div>
    <label class="field"><span>Добавить факт (например, из разговора в чате)</span><input id="e-fact" name="fact" placeholder="открыли второй филиал в октябре"></label>
    <label class="field"><span>Заметки</span><textarea id="e-notes" name="notes">${esc(lead.notes || '')}</textarea></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>Отмена</button><button class="btn primary" type="submit">Сохранить</button></div></form>`, {
    onMount(m, close) {
      m.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault(); const f = formData(e.target);
        const facts = f.fact ? [...(lead.facts || []), { kind: 'manual', text: f.fact, source: 'вручную' }] : lead.facts;
        const phones = f.phone ? [f.phone, ...(lead.contacts?.phones || []).filter(p => p !== f.phone)] : lead.contacts?.phones || [];
        await act(() => call('PUT', '/leads/' + lead.id, { company: f.company, site: f.site, industry: f.industry, notes: f.notes, facts, owner: { name: f.owner, role: f.role, social: { telegram: f.tg } }, contacts: { ...lead.contacts, ownerEmail: f.email, phones } }), 'Сохранено');
        close(); S.render();
      });
    },
  });
}

export function uploadCallModal({ leadId, meetingId } = {}) {
  modal(`<h3>Запись звонка</h3><p class="small mute">Вставьте расшифровку (строки вида «Имя: текст») или загрузите аудио — его распознает подключённый сервис транскрибации (Whisper или Deepgram). Записи из Zoom, Телемоста, МТС Линк и диктофона подключаются вебхуком в «Каналах».</p>
    <label class="field"><span>Название</span><input id="cu-title" value="Диагностика"></label>
    <label class="field"><span>Расшифровка</span><textarea id="cu-text" class="tall" placeholder="Влад: Спасибо, что нашли время…&#10;Дмитрий: …"></textarea></label>
    <label class="field"><span>или аудиофайл (mp3, m4a, wav, до 25 МБ)</span><input type="file" id="cu-audio" accept="audio/*,video/mp4"></label>
    <label class="field"><span>или текстовый файл расшифровки (.txt)</span><input type="file" id="cu-file" accept=".txt,text/plain"></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Отмена</button><button class="btn primary" id="cu-go">Разобрать звонок</button></div>`, {
    onMount(m, close) {
      m.querySelector('#cu-file').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) m.querySelector('#cu-text').value = await f.text(); });
      m.querySelector('#cu-go').addEventListener('click', async () => {
        const audio = m.querySelector('#cu-audio').files[0];
        let r;
        if (audio && !m.querySelector('#cu-text').value.trim()) r = await act(() => S.api.uploadAudio(audio, { leadId, meetingId, filename: audio.name }));
        else r = await act(() => call('POST', '/calls', { leadId, meetingId, transcript: m.querySelector('#cu-text').value, title: m.querySelector('#cu-title').value }));
        if (r) { close(); toast(`Разбор готов: оценка ${r.analysis?.score}`); location.hash = '#calls'; }
      });
    },
  });
}

function dealModal(lead) {
  const os = offers().filter(o => o.priceRub > 0);
  modal(`<h3>Сделка: ${esc(lead.company)}</h3><p class="small mute">Отметьте, что продали. В кейсе «Дмитрий» это консалтинг за 50 000 ₽ и настройка за 250 000 ₽.</p>
    <div class="stack" id="deal-items">${os.map(o => `<label class="switch"><input type="checkbox" value="${o.id}" ${['consult', 'setup'].includes(o.id) ? 'checked' : ''}> ${esc(o.name)} — ${money(o.priceRub)}</label>`).join('')}</div>
    <label class="field"><span>Оплата</span><select id="deal-term">${S.boot.catalog.paymentTerms.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    <div class="form-grid"><label class="field"><span>Статус</span><select id="deal-status"><option value="open">Открыта (счёт выставлен)</option><option value="won">Выиграна (оплачена)</option></select></label><label class="field"><span>Оплачено, ₽</span><input id="deal-paid" type="number" value="0"></label></div>
    <p class="small" id="deal-sum"></p>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Отмена</button><button class="btn primary" id="deal-go">Создать сделку</button></div>`, {
    onMount(m, close) {
      const sum = () => { const ids = [...m.querySelectorAll('#deal-items input:checked')].map(i => i.value); const total = os.filter(o => ids.includes(o.id)).reduce((a, o) => a + o.priceRub, 0); const t = S.boot.catalog.paymentTerms.find(x => x.id === m.querySelector('#deal-term').value); m.querySelector('#deal-sum').innerHTML = `Итого: <b>${money(total)}</b>${t.markup ? ` · с рассрочкой ${money(Math.round(total * (1 + t.markup)))} (${t.parts} платеж.)` : ''}`; };
      m.addEventListener('change', sum); sum();
      m.querySelector('#deal-go').addEventListener('click', async () => {
        const items = [...m.querySelectorAll('#deal-items input:checked')].map(i => ({ offerId: i.value }));
        if (!items.length) return toast('Выберите хотя бы один продукт');
        const r = await act(() => call('POST', '/deals', { leadId: lead.id, items, paymentTerm: m.querySelector('#deal-term').value, status: m.querySelector('#deal-status').value, paidRub: +m.querySelector('#deal-paid').value || 0 }), 'Сделка создана');
        if (r) { close(); S.render(); }
      });
    },
  });
}

export { refreshBoot };
