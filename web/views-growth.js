// Где искать клиентов (много площадок), «Харви: почта», гипотезы HH-партизан vs Харви, валюты рынков, заявки.
import { S, call, act, go, leadHash, refreshBoot } from './state.js';
import { esc, icon, money, toast, hint, fmtDate, pct, formData, $, $$ } from './ui.js';

const MARKETS = [['RU', 'Россия'], ['KZ', 'Казахстан'], ['VN', 'Вьетнам'], ['AE', 'ОАЭ'], ['TR', 'Турция'], ['INT', 'Другие страны']];
const MODE = { api: 'ищет сам', csv: 'список / CSV', manual: 'ручная работа' };

// ====================== ГДЕ ИСКАТЬ КЛИЕНТОВ ======================
export async function viewSources(el) {
  const niche = sessionStorage.getItem('lm-src-niche') || 'all';
  const market = sessionStorage.getItem('lm-src-market') || 'RU';
  const r = await call('GET', `/sources?niche=${encodeURIComponent(niche)}&market=${market}`);
  const groups = {};
  for (const s of r.sources) (groups[s.group] ||= []).push(s);
  el.innerHTML = `
    <div class="page-head"><div><h1>Где искать клиентов</h1><p>Не только hh.ru: площадки вакансий, карты, реестры, сайты и сообщества. Выберите нишу и рынок — система покажет, откуда начинать, и сама поищет там, где есть API.</p></div></div>
    <div class="card" data-tour="src-pick"><div class="form-grid">
      <label class="field"><span>Ниша клиента</span><select id="src-niche"><option value="all">Любая</option>${S.boot.catalog.niches.map(n => `<option value="${n.id}" ${n.id === niche ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Рынок</span><select id="src-market">${MARKETS.map(([id, n]) => `<option value="${id}" ${id === market ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="grid g3 approaches">${Object.entries(r.approaches).map(([id, a]) => `<div class="approach a-${id}"><b>${esc(a.name)}</b><span class="small mute">${esc(a.idea)}</span></div>`).join('')}</div></div>
    ${Object.entries(groups).map(([g, list]) => `<div class="card"><div class="card-head"><h3>${esc(g)}</h3></div><div class="list">
      ${list.map(s => `<div class="item src"><span class="ico ${s.ready ? 'ok' : ''}">${icon(s.approach === 'harvey' ? 'mail' : s.approach === 'inbound' ? 'plug' : 'radar')}</span>
        <div class="body"><div class="title">${esc(s.name)} <span class="pill">${esc(r.approaches[s.approach]?.name || '')}</span> <span class="xs mute">${MODE[s.mode]} · ${esc(s.cost)}</span></div><div class="small mute">${esc(s.signal)}${s.leads ? ` · лидов из источника: ${s.leads}` : ''}</div></div>
        ${s.searchable ? `<button class="btn sm primary" data-search="${s.id}">Искать</button>` : s.id === 'hh' ? '<a class="btn sm primary" href="#signals">Открыть</a>' : s.mode === 'api' && !s.ready ? '<a class="btn sm" href="#channels">Подключить</a>' : s.mode === 'csv' ? '<a class="btn sm" href="#signals">Импорт CSV</a>' : '<a class="btn sm" href="#leads">Добавить вручную</a>'}
      </div>`).join('')}</div></div>`).join('')}
    <div id="src-results"></div>`;
  const re = () => { sessionStorage.setItem('lm-src-niche', $('#src-niche').value); sessionStorage.setItem('lm-src-market', $('#src-market').value); S.render(); };
  $('#src-niche').addEventListener('change', re); $('#src-market').addEventListener('change', re);
  $$('[data-search]').forEach(b => b.addEventListener('click', () => searchForm(b.dataset.search, r.sources.find(s => s.id === b.dataset.search))));
}

function searchForm(id, src) {
  const box = $('#src-results');
  box.innerHTML = `<form class="card" id="src-f"><div class="card-head"><h3>Поиск: ${esc(src.name)}</h3></div><div class="form-grid">
    <label class="field"><span>${src.approach === 'harvey' ? 'Что ищем (рубрика)' : 'Должность в вакансии'}</span><input name="query" value="${src.approach === 'harvey' ? 'стоматология' : 'руководитель отдела продаж'}"></label>
    <label class="field"><span>Город</span><input name="city" placeholder="Москва, Алматы, Хошимин…"></label></div>
    <div class="row"><button class="btn primary">${icon('search')}Найти</button></div></form><div id="src-list"></div>`;
  box.scrollIntoView({ behavior: 'smooth' });
  $('#src-f').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target);
    const r = await act(() => call('POST', '/sources/search', { source: id, query: f.query, city: f.city })); if (!r) return;
    const list = $('#src-list');
    list.innerHTML = `<div class="card"><div class="card-head"><h3>Найдено: ${r.total}</h3><button class="btn primary sm" id="src-imp">Добавить отмеченные в лиды</button></div>
      <div class="list">${r.items.map((x, i) => `<label class="item"><input type="checkbox" data-i="${i}" ${x.preview.imported ? 'disabled' : 'checked'}><div class="body"><div class="title">${esc(x.preview.company)} <span class="xs mute">${esc(x.preview.city || '')}</span></div><div class="small mute">${esc(x.preview.title || '')}${x.preview.email ? ' · ' + esc(x.preview.email) : ''}${x.preview.imported ? ' · уже в лидах' : ''}</div></div><span class="pill">${x.preview.score}</span></label>`).join('') || '<div class="empty">Ничего не нашлось — попробуйте другой запрос или город.</div>'}</div></div>`;
    $('#src-imp')?.addEventListener('click', async () => {
      const items = $$('#src-list input[data-i]:checked').map(c => r.items[+c.dataset.i].raw);
      const res = await act(() => call('POST', '/sources/import', { source: id, kind: r.kind, items }));
      if (res) { toast(`Добавлено лидов: ${res.created}`); if (r.kind === 'org') go('#harvey'); else go('#leads'); }
    });
  });
}

// ====================== ХАРВИ: ПОЧТА ======================
export async function viewHarvey(el) {
  const h = await call('GET', '/harvey');
  el.innerHTML = `
    <div class="page-head"><div><h1>Харви: почта</h1><p>Холодные письма по открытым данным бизнеса. Система предлагает сигналы — вы подтверждаете. Дальше: проверка адреса → 2 коротких письма → вы одобряете → отправка в рабочее время получателя. Второе письмо — только если нет ответа.</p></div>
      <div class="row"><a class="btn" href="#sources">${icon('radar')}Найти компании</a></div></div>
    <div class="grid g4">
      <div class="card kpi"><span class="label">Отправлено</span><b>${h.stats.sent}</b><span class="usd">первых писем</span></div>
      <div class="card kpi"><span class="label">Ответы</span><b>${h.stats.replies}</b><span class="usd">${pct(h.stats.replyRate)}</span></div>
      <div class="card kpi"><span class="label">На одобрении</span><b>${h.outbox.filter(m => m.status === 'approved').length}</b><span class="usd">ждут вас</span></div>
      <div class="card kpi"><span class="label">Запланировано</span><b>${h.stats.scheduled}</b><span class="usd">вторые письма</span></div>
    </div>
    <div class="split">
      <form class="card" id="hv-sig" data-tour="hv-signals"><div class="card-head"><h3>1. Сигналы</h3>${hint('Сигнал — повод написать именно сейчас. Письмо открывается с него. Подтвердите те, что подходят вашему офферу.')}</div>
        <div class="list">${h.signals.map(s => `<label class="item"><input type="checkbox" name="sig" value="${s.code}" ${s.confirmed ? 'checked' : ''}><div class="body"><div class="title">${esc(s.label)}</div><div class="small mute">${esc(s.why)}</div></div><span class="pill">${s.leads}</span></label>`).join('')}</div>
        <div class="row"><button class="btn">Сохранить сигналы</button></div></form>
      <div class="card"><div class="card-head"><h3>2. Когорта: ${h.cohort.length}</h3>${hint('Лиды с email, без касаний и отписки, у которых есть подтверждённый сигнал.')}</div>
        <div class="list">${h.cohort.slice(0, 8).map(c => `<a class="item" href="${leadHash(c.id)}"><div class="body"><div class="title">${esc(c.company)}</div><div class="small mute">${esc(c.email)} · ${esc(c.city || '')} · ${c.signals.map(x => esc(h.signals.find(s => s.code === x)?.label || x)).join(', ')}</div></div></a>`).join('') || '<div class="empty">Пока пусто. Найдите компании на картах в разделе «Где искать клиентов».</div>'}</div>
        <div class="row"><button class="btn primary" id="hv-go" ${h.cohort.length ? '' : 'disabled'}>${icon('mail')}Подготовить письма (2 кредита на компанию)</button></div></div>
    </div>
    <div class="card" data-tour="hv-outbox"><div class="card-head"><h3>3. Исходящие</h3>${h.outbox.some(m => m.status === 'approved') ? '<button class="btn primary sm" id="hv-approve">Одобрить все первые письма</button>' : ''}</div>
      <div class="list">${h.outbox.slice(0, 30).map(m => `<details class="item mail-item"><summary><span class="pill st-${m.status === 'blocked' ? 'lost' : m.status === 'queued' ? 'contacted' : 'new'}">${({ approved: 'на одобрении', queued: 'в очереди', scheduled: 'письмо 2', blocked: 'не прошло фильтр' })[m.status] || m.status}</span> <b>${esc(m.subject)}</b> <span class="small mute">→ ${esc(m.to)} · ${m.sendAfter ? 'не раньше ' + fmtDate(m.sendAfter) : ''}</span></summary>
        <pre class="mail-body">${esc(m.body)}</pre>${m.gate?.length ? `<p class="small" style="color:var(--bad)">${m.gate.map(esc).join(' · ')}</p>` : ''}
        ${m.status !== 'queued' ? `<div class="row"><button class="btn sm ghost" data-skip="${m.id}">Не отправлять</button></div>` : ''}</details>`).join('') || '<div class="empty">Писем пока нет.</div>'}</div></div>
    <form class="card" id="hv-dom"><div class="card-head"><h3>Проверка вашего домена</h3>${hint('Письма доходят, когда домен настроен честно: SPF, DKIM, DMARC, нет в чёрных списках. Обходить фильтры не нужно и нельзя.')}</div>
      <div class="form-grid"><label class="field"><span>Домен отправителя</span><input name="domain" placeholder="leadmeet.ru" value="${esc((S.boot.settings.me?.email || '').split('@')[1] || '')}"></label><label class="field"><span>DKIM-селектор</span><input name="dkim" placeholder="mail"></label></div>
      <div class="row"><button class="btn">Проверить</button></div><div id="hv-dom-r"></div></form>`;
  $('#hv-sig').addEventListener('submit', async (e) => { e.preventDefault(); await act(() => call('PUT', '/harvey', { signals: $$('#hv-sig input[name=sig]:checked').map(i => i.value) }), 'Сигналы сохранены'); S.render(); });
  $('#hv-go')?.addEventListener('click', async () => { const r = await act(() => call('POST', '/harvey/launch', { limit: 20 })); if (r) { toast(`Готово писем: ${r.created}${r.noMx ? `, без почты на домене: ${r.noMx}` : ''}${r.blocked ? `, не прошли фильтр: ${r.blocked}` : ''}`); await refreshBoot(); S.render(); } });
  $('#hv-approve')?.addEventListener('click', async () => { const r = await act(() => call('POST', '/harvey/approve', {})); if (r) { toast(`В очереди: ${r.queued}. Уйдут в рабочее время получателя с паузами.`); S.render(); } });
  $$('[data-skip]').forEach(b => b.addEventListener('click', async () => { await act(() => call('PUT', `/harvey/messages/${b.dataset.skip}`, { status: 'skipped' })); S.render(); }));
  $('#hv-dom').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target);
    const r = await act(() => call('GET', `/harvey/domain?domain=${encodeURIComponent(f.domain)}&dkim=${encodeURIComponent(f.dkim || '')}`)); if (!r) return;
    $('#hv-dom-r').innerHTML = `<div class="list">${r.checks.map(c => `<div class="item"><span class="ico ${c.ok === true ? 'ok' : c.ok === false ? 'warn' : ''}">${icon(c.ok === true ? 'check' : 'shield')}</span><div class="body small">${esc(c.text)}</div></div>`).join('')}</div>`;
  });
}

// ====================== ГИПОТЕЗЫ ======================
export async function viewHypotheses(el) {
  const [h, fx] = await Promise.all([call('GET', '/hypotheses'), call('GET', '/fx/markets')]);
  el.innerHTML = `
    <div class="page-head"><div><h1>Гипотезы и рынки</h1><p>Какой подход приводит на встречи: HH-партизан, Харви (почта) или входящие из рекламы. Трафик — из Яндекс Метрики по utm_source. Ниже — цены ваших офферов в валютах рынков.</p></div></div>
    <div class="card"><div class="card-head"><h3>Подходы</h3></div>
      <div class="table-wrap"><table><thead><tr><th>Подход</th><th class="n">Лидов</th><th class="n">Написали</th><th class="n">Ответы</th><th class="n">Встречи</th><th class="n">Сделки</th><th class="n">Выручка</th></tr></thead>
      <tbody>${h.rows.map(r => `<tr><td><b>${esc(r.name)}</b><div class="xs mute">${esc(r.idea)}</div></td><td class="n">${r.leads}</td><td class="n">${r.contacted}</td><td class="n">${r.replies} <span class="mute xs">${pct(r.replyRate)}</span></td><td class="n">${r.meetings} <span class="mute xs">${pct(r.meetingRate)}</span></td><td class="n">${r.deals}</td><td class="n">${money(r.revenueRub)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small"><b>${esc(h.verdict)}</b></p></div>
    <div class="card"><div class="card-head"><h3>Трафик (Яндекс Метрика, 30 дней)</h3>${S.boot.role === 'owner' ? '<a class="btn sm" href="#channels">Подключить</a>' : ''}</div>
      ${h.traffic?.rows ? `<div class="table-wrap"><table><thead><tr><th>utm_source</th><th class="n">Визиты</th><th class="n">Цели</th><th class="n">Конверсия</th></tr></thead><tbody>${h.traffic.rows.map(r => `<tr><td>${esc(r.source)}</td><td class="n">${r.visits}</td><td class="n">${r.goals}</td><td class="n">${pct(r.visits ? r.goals / r.visits * 100 : 0)}</td></tr>`).join('')}</tbody></table></div>${h.traffic.note ? `<p class="xs mute">${esc(h.traffic.note)}</p>` : ''}`
        : `<p class="small mute">${h.traffic?.error ? esc(h.traffic.error) : 'Метрика не подключена: укажите номер счётчика и OAuth-токен в «Каналах». Ставьте в ссылки utm_source=hh / harvey / yandex_direct — так гипотезы сравнятся честно.'}</p>`}</div>
    <div class="card" data-tour="fx"><div class="card-head"><h3>Цены в валютах рынков</h3>${hint(fx.source)}</div>
      <div class="table-wrap"><table><thead><tr><th>Оффер</th>${fx.markets.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${fx.offers.map(o => `<tr><td>${esc(o.name)}</td>${o.prices.map(p => `<td class="n nowrap">${esc(p.text)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${S.boot.role === 'owner' ? `<form id="fx-f" class="row" style="margin-top:10px"><label class="field"><span>Вторая валюта в скобках</span><select name="second">${fx.currencies.map(c => `<option value="${c.code}" ${c.code === fx.second ? 'selected' : ''}>${esc(c.code)} · ${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field" style="flex:1"><span>Рынки в таблице (коды через запятую)</span><input name="markets" value="${esc(fx.markets.join(', '))}"></label><button class="btn">Сохранить</button></form>` : ''}</div>`;
  $('#fx-f')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target);
    const codes = new Set(fx.currencies.map(c => c.code));
    const markets = String(f.markets).toUpperCase().split(/[\s,;]+/).filter(c => codes.has(c));
    const rates = Object.fromEntries(fx.currencies.map(c => [c.code, c.rate]));
    await act(() => call('PUT', '/settings', { currency: { second: f.second, markets }, fx: { rates } }), 'Сохранено');
    await refreshBoot(); S.render();
  });
}

// ====================== ЗАЯВКИ (нанять продажника / РОПа, агенты) ======================
export async function ordersCard() {
  const list = await call('GET', '/orders').catch(() => []);
  return `<div class="card" data-tour="orders"><div class="card-head"><h3>Заявки клиентов</h3>${hint('Кнопки «Нанять продажника», «Нанять РОПа», «Заменить РОПа» на пульте у вас и у клиентов. Заявка приходит сюда и в Telegram.')}</div>
    <div class="list">${list.slice(0, 20).map(o => `<div class="item"><div class="body"><div class="title">${esc(o.title)} ${o.fromName ? `<span class="xs mute">· ${esc(o.fromName)}</span>` : ''}</div><div class="small mute">${esc(o.contact)} · ${fmtDate(o.createdAt)}${o.details ? ' · ' + esc(o.details.slice(0, 120)) : ''}</div></div>
      <select data-order-st="${o.id}">${[['new', 'новая'], ['in_work', 'в работе'], ['done', 'закрыта'], ['rejected', 'отказ']].map(([v, n]) => `<option value="${v}" ${o.status === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('') || '<div class="empty">Заявок пока нет.</div>'}</div></div>`;
}
export function bindOrders(root) {
  root.querySelectorAll('[data-order-st]').forEach(s => s.addEventListener('change', () => act(() => call('PUT', `/orders/${s.dataset.orderSt}`, { status: s.value }), 'Статус обновлён')));
}
