// Встречи, Скрипт встречи, Разбор звонков, A/B заходов, Аналитика и экономика.
import { S, call, act, go, leadHash, scriptHash, hookName, offers } from './state.js';
import { esc, icon, money, toast, modal, hint, copy, fmtDate, formData, scoreRing, pct, $, $$ } from './ui.js';
import { uploadCallModal } from './views-main.js';
import { safeUrl } from '../core/util.js';

// ====================== ВСТРЕЧИ ======================
export async function viewMeetings(el) {
  const ms = await call('GET', '/meetings');
  const up = ms.filter(m => m.status === 'scheduled'), past = ms.filter(m => m.status !== 'scheduled');
  const row = (m) => `<div class="item"><span class="ico">${icon('calendar')}</span><div class="body"><div class="title">${fmtDate(m.at)} · ${esc(m.lead?.owner || '')} ${m.lead?.company ? '(' + esc(m.lead.company) + ')' : ''}</div><div class="small mute">${m.status === 'done' ? 'проведена' : m.status === 'noshow' ? 'не пришёл' : 'назначена'}${safeUrl(m.link) ? ' · <a href="' + esc(safeUrl(m.link)) + '" target="_blank" rel="noopener">ссылка на звонок</a>' : ''}</div></div>
    <div class="row"><a class="btn sm primary" href="${scriptHash(m.leadId)}">Скрипт</a><button class="btn sm" data-up="${m.id}" data-lead="${m.leadId}">Загрузить запись</button>${m.status === 'scheduled' ? `<button class="btn sm ghost" data-noshow="${m.id}">Не пришёл</button>` : ''}<a class="btn sm ghost" href="${leadHash(m.leadId)}">Лид</a></div></div>`;
  el.innerHTML = `<div class="page-head"><div><h1>Встречи</h1><p>Перед каждой встречей — персональный скрипт продающего интервью; после — запись звонка на разбор.</p></div></div>
    <div class="card" data-tour="meetings-list"><h3>Предстоящие</h3><div class="list">${up.map(row).join('') || '<div class="empty">Встреч нет. Назначьте встречу из карточки лида, когда собственник ответит.</div>'}</div></div>
    <div class="card"><h3>Прошедшие</h3><div class="list">${past.map(row).join('') || '<p class="mute small">Пока нет.</p>'}</div></div>`;
  el.addEventListener('click', async (e) => {
    const u = e.target.closest('[data-up]'); if (u) return uploadCallModal({ leadId: u.dataset.lead, meetingId: u.dataset.up });
    const n = e.target.closest('[data-noshow]'); if (n) { await act(() => call('PUT', '/meetings/' + n.dataset.noshow, { status: 'noshow' }), 'Отмечено'); S.render(); }
  });
}

// ====================== СКРИПТ ======================
export async function viewScript(el, leadId) {
  const sc = await call('GET', `/leads/${leadId}/script`);
  let done = new Set();
  el.innerHTML = `<div class="page-head"><div><a class="btn ghost sm" href="${leadHash(leadId)}">← К лиду</a><h1 style="margin-top:8px">${esc(sc.title)}</h1><p>Продающее интервью на ${sc.durationMin} минут: рамка встречи → факты о компании → вопросы SPIN → решение его словами → возражения → закрытие. Отмечайте этапы по ходу звонка.</p></div>
    <div class="row"><span class="tag brand" id="timer">00:00</span><button class="btn" id="t-start">${icon('clock')}Таймер</button><button class="btn" id="sc-copy">${icon('copy')}Копировать скрипт</button><button class="btn primary" id="sc-up">${icon('mic')}Загрузить запись</button></div></div>
    <div class="card"><h3>Перед звонком</h3><ul class="facts">${sc.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <div class="stack" id="stages" data-tour="script-stages">${sc.stages.map(s => `<section class="stage" data-st="${s.id}">
      <h3><input type="checkbox" aria-label="Этап пройден" data-done="${s.id}"> ${esc(s.title)}<span class="min">${s.min} мин</span></h3>
      <p class="small mute">${esc(s.goal)}</p>
      ${s.hints?.length ? `<ul class="small">${s.hints.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${s.say?.length ? `<div class="stack say">${s.say.map(t => s.id === 'close' && t.startsWith('«') ? `<div class="close-line">${esc(t)}</div>` : `<p>${esc(t)}</p>`).join('')}</div>` : ''}
      ${s.ask?.length ? `<ul>${s.ask.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
      ${s.calc ? `<p class="small"><b>Расчёт:</b> ${esc(s.calc)}</p>` : ''}
      ${s.objections ? `<div class="stack">${s.objections.map(o => `<details><summary>«${esc(o.q)}»</summary><p class="small">${esc(o.a)}</p></details>`).join('')}</div>` : ''}
    </section>`).join('')}</div>`;
  $('#stages').addEventListener('change', (e) => { const c = e.target.closest('[data-done]'); if (!c) return; c.closest('.stage').classList.toggle('done', c.checked); c.checked ? done.add(c.dataset.done) : done.delete(c.dataset.done); });
  let t0 = 0, tid = null;
  $('#t-start').addEventListener('click', () => {
    if (tid) { clearInterval(tid); tid = null; $('#t-start').lastChild.textContent = 'Таймер'; return; }
    t0 = Date.now(); tid = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const el2 = $('#timer'); if (!el2) return clearInterval(tid); el2.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; el2.className = 'tag ' + (s > sc.durationMin * 60 ? 'warn' : 'brand'); }, 1000);
    $('#t-start').lastChild.textContent = 'Стоп';
  });
  $('#sc-copy').addEventListener('click', () => copy(sc.stages.map(s => `${s.title}\n${[...(s.say || []), ...(s.ask || []).map(a => '— ' + a)].join('\n')}`).join('\n\n')));
  $('#sc-up').addEventListener('click', () => uploadCallModal({ leadId }));
}

// ====================== ЗВОНКИ ======================
const STAGE_NAMES = { frame: 'рамка', wow: 'факты', situation: 'ситуация', problem: 'проблема', implication: 'последствия', payoff: 'выгода', offer: 'предложение', close: 'закрытие', next: 'след. шаг' };
const OBJ_NAMES = { price: 'дорого', think: 'подумаю', partner: 'партнёр', time: 'нет времени', contractor: 'есть подрядчик', tried: 'пробовали', guarantee: 'гарантии', diy: 'сами' };

export async function viewCalls(el) {
  const [calls, learn] = await Promise.all([call('GET', '/calls'), call('GET', '/calls/learn')]);
  el.innerHTML = `<div class="page-head"><div><h1>Разбор звонков</h1><p>Каждая запись разбирается по метрикам: доля речи, вопросы, пройденные этапы, возражения, следующий шаг. Сводка по всем звонкам показывает, что улучшить в скрипте.</p></div><button class="btn primary" id="new-call">${icon('mic')}Загрузить звонок</button></div>
    <div class="grid g4" data-tour="calls-learn">
      <div class="card kpi"><span class="label">Звонков разобрано</span><b>${learn.calls}</b></div>
      <div class="card kpi"><span class="label">Средняя оценка</span><b>${learn.avgScore}</b></div>
      <div class="card kpi"><span class="label">Доля вашей речи ${hint('Цель 40–50%. В открытых исследованиях Gong Labs у лучших продавцов около 43%.')}</span><b>${learn.avgTalkRatio}%</b></div>
      <div class="card kpi"><span class="label">Вопросов за звонок</span><b>${learn.avgQuestions}</b></div>
    </div>
    ${learn.calls ? `<div class="card"><h3>Чему учит ваша практика</h3><div class="grid g2"><div><span class="label">Частые возражения</span><div class="chips" style="margin-top:6px">${learn.topObjections.map(o => `<span class="tag warn">${esc(OBJ_NAMES[o.id] || o.id)} × ${o.n}</span>`).join('') || '<span class="mute small">нет</span>'}</div></div><div><span class="label">Чаще всего пропускаете</span><div class="chips" style="margin-top:6px">${learn.weakStages.map(o => `<span class="tag">${esc(STAGE_NAMES[o.id] || o.id)} × ${o.n}</span>`).join('') || '<span class="mute small">все этапы пройдены</span>'}</div></div></div></div>` : ''}
    <div class="stack" id="call-list">${calls.map(c => callCard(c)).join('') || '<div class="card empty">Звонков пока нет. Загрузите расшифровку или аудио.</div>'}</div>`;
  $('#new-call').addEventListener('click', () => uploadCallModal({}));
}

function callCard(c) {
  const a = c.analysis || {};
  return `<div class="card"><div class="card-head"><div class="row">${scoreRing(a.score || 0, true)}<div><h3>${esc(c.title)}</h3><div class="small mute">${fmtDate(c.createdAt)} · ${esc(c.source)}${c.leadId ? ` · <a href="${leadHash(c.leadId)}">лид</a>` : ''}</div></div></div></div>
    <div class="grid g3 small">
      <div><span class="label">Доля речи</span><div class="bar ${a.talkRatio > 55 ? 'warn' : 'ok'}" style="margin:6px 0"><i style="width:${a.talkRatio}%"></i></div>${a.talkRatio}% вы · ${100 - a.talkRatio}% клиент</div>
      <div><span class="label">Вопросов</span><br><b style="font-size:20px">${a.myQuestions}</b> <span class="mute">цель 11–14</span></div>
      <div><span class="label">Следующий шаг</span><br>${a.nextStep ? '<span class="tag ok">зафиксирован</span>' : '<span class="tag bad">нет</span>'} ${a.closeAsked ? '<span class="tag ok">закрывающий вопрос</span>' : ''}</div>
    </div>
    <div><span class="label">Этапы</span><div class="chips" style="margin-top:6px">${Object.keys(STAGE_NAMES).map(s => `<span class="tag ${a.stages?.covered?.includes(s) ? 'ok' : ''}">${STAGE_NAMES[s]}</span>`).join('')}</div></div>
    ${a.objections?.length ? `<div><span class="label">Возражения</span><ul class="facts" style="margin-top:6px">${a.objections.map(o => `<li><span><span class="tag ${o.handled ? 'ok' : 'warn'}">${esc(OBJ_NAMES[o.id] || o.id)}</span> «${esc(o.text.slice(0, 120))}»</span></li>`).join('')}</ul></div>` : ''}
    ${a.recommendations?.length ? `<div><span class="label">Что улучшить</span><ul class="issues" style="margin-top:6px">${a.recommendations.map(r => `<li class="warn">${esc(r)}</li>`).join('')}</ul></div>` : ''}
    ${a.pains?.length ? `<details><summary>Боли собственника его словами (${a.pains.length}) — для письма после встречи и для кейса</summary><ul class="facts">${a.pains.map(p => `<li>«${esc(p)}»</li>`).join('')}</ul></details>` : ''}
    ${c.deep && !c.deep.error ? `<details open><summary>Разбор Claude</summary><p class="small">${esc(c.deep.summary)}</p><ul class="small">${(c.deep.scriptImprovements || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small"><b>Письмо после встречи:</b> ${esc(c.deep.nextStepEmail)}</p></details>` : ''}
  </div>`;
}

// ====================== ЭКСПЕРИМЕНТЫ ======================
export async function viewExperiments(el) {
  const exps = await call('GET', '/experiments');
  el.innerHTML = `<div class="page-head"><div><h1>A/B заходов и офферов</h1><p>Каждый эксперимент сравнивает заходы на реальных касаниях. Вероятность «вариант лучший» считается байесовски; победитель объявляется, когда P ≥ 95% и у каждого варианта не меньше 30 касаний. Следующему лиду система чаще предлагает лидирующий вариант, но продолжает проверять остальные.</p></div><button class="btn primary" id="new-exp" data-tour="new-exp">${icon('plus')}Новый эксперимент</button></div>
    ${exps.map(x => `<div class="card"><div class="card-head"><div><h3>${esc(x.name)}</h3><p class="small mute">${esc(x.hypothesis || '')} · метрика: ${x.metric === 'meeting' ? 'встреча' : 'ответ'}</p></div><div class="row">${x.stats.winner ? `<span class="tag ok">победитель: ${esc(x.stats.rows.find(r => r.id === x.stats.winner)?.name)}</span>` : `<span class="tag">нужно ещё ${x.stats.moreTouchesNeeded} касаний на вариант</span>`}<button class="btn sm" data-toggle="${x.id}" data-status="${x.status}">${x.status === 'running' ? 'Остановить' : 'Запустить'}</button></div></div>
      <div class="table-wrap"><table><thead><tr><th>Вариант</th><th>Заход</th><th class="n">Касаний</th><th class="n">Успехов</th><th class="n">Конверсия</th><th class="n">95% интервал</th><th>Вероятность лучшего</th></tr></thead><tbody>
      ${x.stats.rows.map(r => `<tr><td><b>${esc(r.id)}</b> ${esc(r.name)}</td><td class="small">${esc(hookName(r.hook))}</td><td class="n">${r.n}</td><td class="n">${r.k}</td><td class="n">${pct(r.rate)}</td><td class="n mute">${r.ci[0]}–${r.ci[1]}%</td><td style="min-width:160px"><div class="row" style="flex-wrap:nowrap"><div class="bar ${r.id === x.stats.leader ? 'ok' : ''}" style="flex:1"><i style="width:${r.pBest}%"></i></div><span class="small num">${pct(r.pBest)}</span></div></td></tr>`).join('')}
      </tbody></table></div></div>`).join('') || '<div class="card empty">Экспериментов нет. Создайте первый: например «Вакансия» против «Факты + вопрос».</div>'}
    <div class="card"><h3>Библиотека заходов</h3><div class="list">${S.boot.catalog.hooks.map(h => `<div class="item"><div class="body"><div class="title">${esc(h.name)}</div><div class="small mute">${esc(h.idea)}</div></div></div>`).join('')}</div></div>`;
  $('#new-exp').addEventListener('click', newExpModal);
  el.addEventListener('click', async (e) => { const b = e.target.closest('[data-toggle]'); if (!b) return; await act(() => call('PUT', '/experiments/' + b.dataset.toggle, { status: b.dataset.status === 'running' ? 'done' : 'running' }), 'Обновлено'); S.render(); });
}

function newExpModal() {
  const hooks = S.boot.catalog.hooks; const os = offers();
  const vRow = (i, hook) => `<div class="form-grid" data-v="${i}"><label class="field"><span>Вариант ${String.fromCharCode(65 + i)}: заход</span><select id="v${i}-hook">${hooks.map(h => `<option value="${h.id}" ${h.id === hook ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label><label class="field"><span>Оффер</span><select id="v${i}-offer">${os.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join('')}</select></label></div>`;
  modal(`<h3>Новый эксперимент</h3>
    <label class="field"><span>Название</span><input id="x-name" value="IT-собственники: факты против кейса"></label>
    <label class="field"><span>Гипотеза</span><input id="x-hyp" value="Собственники IT-студий чаще отвечают на конкретные факты о компании, чем на кейс."></label>
    <label class="field"><span>Метрика успеха</span><select id="x-metric"><option value="meeting">Назначена встреча</option><option value="reply">Получен ответ</option></select></label>
    <div id="x-vars" class="stack">${vRow(0, 'facts')}${vRow(1, 'case')}</div>
    <div class="row"><button class="btn sm" id="x-add">${icon('plus')}Вариант</button></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Отмена</button><button class="btn primary" id="x-go">Создать</button></div>`, {
    onMount(m, close) {
      let n = 2;
      m.querySelector('#x-add').addEventListener('click', () => { if (n >= 4) return toast('Не больше 4 вариантов — иначе данных не хватит'); m.querySelector('#x-vars').insertAdjacentHTML('beforeend', vRow(n, hooks[n % hooks.length].id)); n++; });
      m.querySelector('#x-go').addEventListener('click', async () => {
        const variants = [...m.querySelectorAll('[data-v]')].map((d, i) => ({ id: String.fromCharCode(65 + i), name: hooks.find(h => h.id === d.querySelector('select').value).name, hook: d.querySelector('select').value, offerId: d.querySelectorAll('select')[1].value }));
        const r = await act(() => call('POST', '/experiments', { name: m.querySelector('#x-name').value, hypothesis: m.querySelector('#x-hyp').value, metric: m.querySelector('#x-metric').value, variants }), 'Эксперимент запущен');
        if (r) { close(); S.render(); }
      });
    },
  });
}

// ====================== АНАЛИТИКА И ЭКОНОМИКА ======================
export async function viewAnalytics(el) {
  const a = await call('GET', '/analytics');
  const f = a.funnel; const top = Math.max(1, f[0].n);
  const canEdit = S.boot.role !== 'observer';
  el.innerHTML = `<div class="page-head"><div><h1>Аналитика и деньги</h1><p>Фактическая воронка, окупаемость каналов и заходов, модель на месяц вперёд. Все суммы в рублях и в долларах.</p></div></div>
    <div class="grid g2">
      <div class="card"><h3>Фактическая воронка</h3><div class="funnel">${f.map((s, i) => `<div class="funnel-row st-${s.stage}"><span>${esc(s.name)}</span><div class="track"><i style="width:${(s.n / top) * 100}%"></i></div><b>${s.n}</b><span class="conv">${i ? pct(f[i - 1].n ? (s.n / f[i - 1].n) * 100 : 0) : ''}</span></div>`).join('')}</div>
        <div class="row small"><span>Выручка: <b>${money(a.revenueRub)}</b></span><span>Сделок: <b>${a.dealsWon}</b></span><span>Средний чек: <b>${a.actual.avgCheckRub ? money(a.actual.avgCheckRub) : '—'}</b></span></div></div>
      <div class="card"><h3>Какие заходы приводят на встречу</h3><div class="table-wrap"><table><thead><tr><th>Заход</th><th class="n">Касаний</th><th class="n">Ответы</th><th class="n">Встречи</th></tr></thead><tbody>${a.byHook.map(h => `<tr><td>${esc(h.name)}</td><td class="n">${h.sent}</td><td class="n">${pct(h.replyRate)}</td><td class="n"><b>${pct(h.meetingRate)}</b></td></tr>`).join('') || '<tr><td colspan="4" class="mute">Нет данных</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="card" data-tour="roi"><h3>Каналы: окупаемость ${hint('Расходы по рекламным каналам укажите в разделе «Каналы». CPL — цена лида, CAC — цена клиента.')}</h3><div class="table-wrap"><table><thead><tr><th>Источник</th><th class="n">Лиды</th><th class="n">Встречи</th><th class="n">Сделки</th><th class="n">Выручка</th><th class="n">Расход</th><th class="n">CPL</th><th class="n">CAC</th><th class="n">ROI</th></tr></thead><tbody>
      ${a.bySource.map(r => `<tr><td>${esc(r.source)}</td><td class="n">${r.leads}</td><td class="n">${r.meetings}</td><td class="n">${r.deals}</td><td class="n">${money(r.revenueRub, { usd: false })}</td><td class="n">${money(r.spendRub, { usd: false })}</td><td class="n">${r.cplRub != null ? money(r.cplRub, { usd: false }) : '—'}</td><td class="n">${r.cacRub != null ? money(r.cacRub, { usd: false }) : '—'}</td><td class="n">${r.roiPct != null ? pct(r.roiPct) : '—'}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="grid g2">
      <form class="card" id="fm" data-tour="model"><div class="card-head"><h3>Модель месяца</h3>${canEdit ? '<button class="btn sm" type="button" id="fm-actual">Подставить мои фактические конверсии</button>' : ''}</div>
        <div class="form-grid">
          ${numField('signalsPerMonth', 'Сигналов в месяц', 600)}${numField('researchRate', 'Доля исследуем и пишем', 0.5, 0.05)}${numField('replyRate', 'Доля ответов', 0.12, 0.01)}${numField('meetingRate', 'Доля ответ → встреча', 0.4, 0.05)}
          ${numField('showRate', 'Доходимость', 0.8, 0.05)}${numField('closeRate', 'Встреча → сделка', 0.25, 0.05)}${numField('avgCheckRub', 'Средний чек, ₽', 250000, 10000)}${numField('upsellRub', 'Допродажа, ₽', 50000, 5000)}
          ${numField('costPerSignalRub', 'Себестоимость касания, ₽', 15)}${numField('fixedMonthlyRub', 'Постоянные расходы, ₽', 30000, 1000)}${numField('trafficSpendRub', 'Реклама, ₽', 0, 1000)}${numField('hoursPerMeeting', 'Часов на встречу', 1.5, 0.5)}
        </div><div id="fm-out"></div></form>
      <div class="stack">
        <form class="card" id="pb"><h3>Окупаемость для клиента ${hint('Посчитайте вместе с собственником на встрече: сколько он вкладывает и сколько возвращает в месяц.')}</h3>
          <div class="form-grid">${numField('investRub', 'Вложение, ₽', 300000, 10000)}${numField('monthlyGainRub', 'Доп. маржа в месяц, ₽', 400000, 10000)}${numField('monthlyCostRub', 'Расходы в месяц, ₽', 36000, 1000)}${numField('months', 'Горизонт, мес.', 12)}</div><div id="pb-out"></div></form>
        <form class="card" id="saas"><h3>Модель платформы (абонентка + кредиты)</h3>
          <div class="form-grid">${numField('clients', 'Клиентов', 20)}${numField('planPriceRub', 'Абонентка, ₽', 39900, 1000)}${numField('creditRevenuePerClientRub', 'Кредиты на клиента, ₽', 8000, 1000)}${numField('churnMonthly', 'Отток в месяц', 0.06, 0.01)}${numField('cogsPct', 'Себестоимость, доля', 0.18, 0.01)}${numField('cacRub', 'Цена привлечения, ₽', 30000, 1000)}</div><div id="saas-out"></div></form>
      </div>
    </div>`;
  const run = async (form, path, out, render) => { const r = await call('POST', path, formData(form)).catch(e => ({ error: e.message })); $(out).innerHTML = r.error ? `<p class="mute">${esc(r.error)}</p>` : render(r); };
  const fm = () => run($('#fm'), '/economics/funnel', '#fm-out', (r) => `<hr class="sep"><div class="grid g3 small">
    <div><span class="label">Касаний</span><br><b>${r.touched}</b></div><div><span class="label">Встреч</span><br><b>${r.meetingsHeld}</b></div><div><span class="label">Сделок</span><br><b>${r.deals}</b></div>
    <div><span class="label">Выручка</span><br><b>${money(r.revenueRub)}</b></div><div><span class="label">Расходы</span><br><b>${money(r.costRub)}</b></div><div><span class="label">Прибыль</span><br><b>${money(r.profitRub)}</b></div>
    <div><span class="label">CAC</span><br><b>${r.cacRub != null ? money(r.cacRub) : '—'}</b></div><div><span class="label">ROI</span><br><b>${r.roiPct != null ? pct(r.roiPct) : '—'}</b></div><div><span class="label">Выручка с часа встреч</span><br><b>${money(r.revenuePerHourRub)}</b></div></div>
    <p class="small mute">Безубыточность: ${String(r.breakEvenDeals).replace('.', ',')} сделки в месяц. На одну сделку нужно ${r.signalsPerDeal ?? '—'} сигналов.</p>`);
  const pb = () => run($('#pb'), '/economics/payback', '#pb-out', (r) => `<p><b>${r.paybackMonths != null ? 'Окупится за ' + String(r.paybackMonths).replace('.', ',') + ' мес.' : 'Не окупается при этих цифрах'}</b> · ROI за горизонт: ${r.roiPct != null ? pct(r.roiPct) : '—'} · чистыми: ${money(r.totalNetRub)}</p>${sparkline(r.curve.map(c => c.cumulativeRub))}`);
  const sa = () => run($('#saas'), '/economics/saas', '#saas-out', (r) => `<div class="grid g3 small"><div><span class="label">MRR</span><br><b>${money(r.mrrRub)}</b></div><div><span class="label">ARR</span><br><b>${money(r.arrRub)}</b></div><div><span class="label">LTV / CAC</span><br><b>${r.ltvToCac ?? '—'}</b></div><div><span class="label">ARPU</span><br><b>${money(r.arpuRub)}</b></div><div><span class="label">LTV</span><br><b>${r.ltvRub ? money(r.ltvRub) : '—'}</b></div><div><span class="label">Окупаемость CAC</span><br><b>${r.cacPaybackMonths ?? '—'} мес.</b></div></div>`);
  $('#fm').addEventListener('input', fm); $('#pb').addEventListener('input', pb); $('#saas').addEventListener('input', sa);
  $('#fm-actual')?.addEventListener('click', () => {
    const act2 = a.actual; const set = (k, v) => { if (v && Number.isFinite(v)) $(`#fm [name=${k}]`).value = Math.round(v * 100) / 100; };
    set('replyRate', act2.replyRate); set('meetingRate', act2.meetingRate); set('closeRate', act2.closeRate); if (act2.avgCheckRub) $('#fm [name=avgCheckRub]').value = act2.avgCheckRub;
    fm(); toast('Подставлены фактические конверсии из вашей воронки');
  });
  fm(); pb(); sa();
}

const numField = (name, label, val, step = 1) => `<label class="field"><span>${esc(label)}</span><input type="number" id="f-${name}" name="${name}" value="${val}" step="${step}"></label>`;

function sparkline(vals) {
  if (!vals.length) return '';
  const w = 320, h = 70, pad = 6; const min = Math.min(0, ...vals), max = Math.max(0, ...vals); const sx = (i) => pad + (i / Math.max(1, vals.length - 1)) * (w - 2 * pad); const sy = (v) => h - pad - ((v - min) / Math.max(1, max - min)) * (h - 2 * pad);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Накопленный результат по месяцам"><line x1="${pad}" x2="${w - pad}" y1="${sy(0)}" y2="${sy(0)}" stroke="var(--line)" stroke-dasharray="3 3"/><path d="${d}" fill="none" stroke="var(--brand)" stroke-width="2.5"/><circle cx="${sx(vals.length - 1)}" cy="${sy(vals[vals.length - 1])}" r="4" fill="var(--brand)"/><text x="${pad}" y="${Math.min(h - 2, sy(0) - 4)}" font-size="10" fill="var(--mute)">0 ₽</text></svg>`;
}

export { go, modal, copy, formData };
