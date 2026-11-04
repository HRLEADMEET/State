// Каналы, Кабинеты и тарифы, Инвесторам, Безопасность, Настройки, Памятка с котиком.
import { S, call, act, refreshBoot } from './state.js';
import { esc, icon, money, usd, toast, modal, hint, copy, fmtDate, formData, pct, $, $$ } from './ui.js';

const MODE = { api: ['API', 'ok'], webhook: ['вебхук', 'brand'], manual: ['живое касание', 'warn'] };

// ====================== КАНАЛЫ ======================
export async function viewChannels(el) {
  const chans = await call('GET', '/channels');
  const base = S.boot.baseUrl || location.origin;
  const groups = [['Вход лидов', c => c.dir === 'in' || c.dir === 'both'], ['Исходящие касания', c => c.dir === 'out'], ['Сервисы', c => c.dir === 'none']];
  el.innerHTML = `<div class="page-head"><div><h1>Каналы</h1><p>Конструктор подключений: откуда приходят лиды и через что вы пишете. Секреты (пароли, токены) шифруются AES-256 и в интерфейсе видны только последние 3 символа.</p></div></div>
    ${groups.map(([title, f]) => `<h2>${title}</h2><div class="grid g3">${chans.filter(f).map(c => channelCard(c, base)).join('')}</div>`).join('')}`;
  el.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-ch]'); if (!form) return;
    e.preventDefault();
    const fd = formData(form); const type = form.dataset.ch;
    const config = {}; for (const k of Object.keys(fd)) if (k.startsWith('cfg_')) config[k.slice(4)] = fd[k];
    await act(() => call('PUT', '/channels/' + type, { enabled: fd.enabled, spendRub: fd.spendRub, config }), 'Канал сохранён');
    await refreshBoot(); S.render();
  });
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-test]'); if (t) { const r = await act(() => call('POST', `/channels/${t.dataset.test}/test`)); if (r) toast(r.message, r.ok ? '' : 'bad'); }
    const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy);
  });
}

function channelCard(c, base) {
  const [m, cls] = MODE[c.mode] || ['', ''];
  const hookUrl = `${base}/api/hooks/lead/${c.type}?key=${c.hookKey}`;
  const extra = [];
  if (c.mode === 'webhook' && c.hookKey) extra.push(`<div class="field"><span>Адрес вебхука ${hint('Укажите его в настройках рекламного кабинета, лид-формы или Zapier/Make. Заявка сразу появится в Лидах, а вам придёт уведомление.')}</span><div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(hookUrl)}"><button type="button" class="btn sm" data-copy="${esc(hookUrl)}">${icon('copy')}</button></div></div>`);
  if (c.type === 'site_form' && c.hookKey) { const snip = `<form data-leadmeet>\n  <input name="name" placeholder="Имя">\n  <input name="phone" placeholder="Телефон">\n  <button>Отправить</button>\n</form>\n<script src="${base}/widget.js?key=${c.hookKey}"></script>`; extra.push(`<div class="field"><span>Код для любого сайта</span><div class="code">${esc(snip)}</div><button type="button" class="btn sm" data-copy="${esc(snip)}">${icon('copy')}Скопировать код</button></div>`); }
  if (c.type === 'recorder' && c.hookKey) extra.push(`<div class="field"><span>Вебхук для готовых расшифровок</span><div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(`${base}/api/hooks/transcript?key=${c.hookKey}`)}"><button type="button" class="btn sm" data-copy="${esc(`${base}/api/hooks/transcript?key=${c.hookKey}`)}">${icon('copy')}</button></div></div>`);
  if (!c.hookKey && c.mode === 'webhook') extra.push('<p class="xs mute">Сохраните канал, чтобы получить адрес вебхука.</p>');
  const isAd = ['yandex_direct', 'google_ads', 'tiktok', 'instagram', 'vk'].includes(c.type);
  return `<form class="card" data-ch="${c.type}" data-tour="ch-${c.type}"><div class="card-head"><h3>${esc(c.name)}</h3><span class="tag ${cls}">${m}</span></div>
    <p class="small mute">${esc(c.doc)}</p>
    <label class="switch"><input type="checkbox" name="enabled" id="ch-${c.type}-on" ${c.enabled ? 'checked' : ''}> Включён</label>
    ${c.fields.map(f => `<label class="field"><span>${esc(f.label)}</span><input id="ch-${c.type}-${f.k}" name="cfg_${f.k}" ${f.secret ? 'type="password" autocomplete="new-password"' : ''} value="${esc(c.config[f.k] || '')}"></label>`).join('')}
    ${isAd ? `<label class="field"><span>Расход за период, ₽ ${hint('Для расчёта CPL, CAC и ROI в Аналитике.')}</span><input type="number" id="ch-${c.type}-spend" name="spendRub" value="${c.spendRub || 0}"></label>` : ''}
    ${extra.join('')}
    <div class="row"><button class="btn primary sm" type="submit">Сохранить</button>${['email', 'telegram_bot', 'hh', 'llm'].includes(c.type) ? `<button class="btn sm" type="button" data-test="${c.type}">Проверить</button>` : ''}</div></form>`;
}

// ====================== КАБИНЕТЫ И ТАРИФЫ ======================
export async function viewCabinets(el) {
  const b = S.boot;
  const members = S.api.mode === 'server' ? await S.api.auth.members().catch(() => []) : [];
  el.innerHTML = `<div class="page-head"><div><h1>Кабинеты и тарифы</h1><p>Отгружайте клиентам ту же систему, что привела их к вам: отдельный кабинет со своими лидами, каналами и аналитикой. Настройки, офферы и эксперименты копируются из вашего кабинета: это «идеальная модель», которую вы тиражируете.</p></div></div>
    <div class="grid g2">
      <div class="card"><h3>Ваши кабинеты</h3><div class="list">${(b.workspaces || []).map(w => `<div class="item"><span class="ico">${icon('layers')}</span><div class="body"><div class="title">${esc(w.name)}</div><div class="small mute">${w.kind === 'client' ? 'кабинет клиента' : 'собственный'}${w.role ? ' · ' + esc(b.catalog.roles[w.role]?.name || w.role) : ''}</div></div>${w.id === b.ws.id ? '<span class="tag ok">открыт</span>' : `<button class="btn sm" data-switch="${w.id}">Открыть</button>`}</div>`).join('')}</div></div>
      <form class="card" id="new-ws" data-tour="new-ws"><h3>Новый кабинет клиента</h3>
        <label class="field"><span>Название</span><input id="ws-name" name="name" required placeholder="ТехноСервис Про — отдел продаж"></label>
        <label class="field"><span>Тариф</span><select id="ws-plan" name="plan">${b.catalog.plans.map(p => `<option value="${p.id}">${esc(p.name)} — ${money(p.priceRub, { usd: false })}/мес, ${p.credits} кредитов</option>`).join('')}</select></label>
        <label class="switch"><input type="checkbox" id="ws-clone" name="cloneFrom" checked> Скопировать мою модель (офферы, заходы, эксперименты)</label>
        <div><button class="btn primary" type="submit">${icon('plus')}Создать кабинет</button></div></form>
    </div>
    <h2>Тарифы платформы</h2>
    <div class="grid g3">${b.catalog.plans.map(p => `<div class="card"><div class="card-head"><h3>${esc(p.name)}</h3>${b.ws.plan === p.id ? '<span class="tag ok">ваш</span>' : ''}</div><div class="kpi"><b>${money(p.priceRub, { usd: false })}</b><span class="usd">${usd(p.priceRub)} в месяц · ${p.credits} кредитов · ${p.seats} мест · ${p.workspaces} кабинетов</span></div><ul class="facts">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="card" data-tour="credits-packs"><div class="card-head"><h3>Кредиты</h3>${hint('Кредиты списываются за действия с себестоимостью: исследование компании, персональное письмо, разбор звонка. Так клиент платит за результат, а вы не уходите в минус по ИИ и данным.')}</div>
      <div class="row small">${Object.entries(b.catalog.creditCost).map(([k, v]) => `<span class="tag">${({ research: 'исследование', message: 'письмо', llm_message: 'письмо с Claude', call_analysis: 'разбор звонка', transcribe_min: 'минута транскрибации' })[k] || k}: ${v}</span>`).join('')}</div>
      <div class="grid g3">${b.catalog.creditPacks.map(p => `<div class="card flat" style="background:var(--surface-2)"><b style="font-size:20px">${p.credits.toLocaleString('ru-RU')} кредитов</b><span>${money(p.priceRub)}</span><button class="btn sm" data-buy="${p.id}">${S.api.mode === 'demo' ? 'Начислить (демо)' : 'Купить'}</button></div>`).join('')}</div></div>
    ${S.api.mode === 'server' ? `<div class="card"><div class="card-head"><h3>Команда и доступы</h3></div>
      <div class="list">${members.map(m => `<div class="item"><div class="body"><div class="title">${esc(m.name || m.email)}</div><div class="small mute">${esc(m.email)}</div></div><span class="tag">${esc(b.catalog.roles[m.role]?.name || m.role)}</span></div>`).join('')}</div>
      <form id="invite" class="row"><input id="inv-email" name="email" type="email" placeholder="email" style="max-width:240px"><select id="inv-role" name="role"><option value="manager">Менеджер</option><option value="client">Клиент</option><option value="observer">Наблюдатель / инвестор</option></select><button class="btn" type="submit">Создать приглашение</button></form><div id="inv-out"></div></div>` : ''}`;
  $('#new-ws').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); const r = await act(() => call('POST', '/workspaces', f), 'Кабинет создан'); if (r) { await refreshBoot(); S.render(); } });
  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-switch]'); if (s) { await act(() => S.api.auth.switch(s.dataset.switch)); location.hash = '#dashboard'; location.reload(); }
    const bu = e.target.closest('[data-buy]'); if (bu) { const r = await act(() => call('POST', '/billing/credits', { packId: bu.dataset.buy })); if (r) { toast(`Баланс: ${r.credits} кредитов`); const c = $('#credit-count'); if (c) c.textContent = r.credits; } }
  });
  $('#invite')?.addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); const r = await act(() => S.api.auth.invite(f)); if (r) $('#inv-out').innerHTML = `<p class="small">Ссылка на 7 дней (роль: ${esc(r.role)}):</p><div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(r.link)}"><button class="btn sm" data-copy-inv>${icon('copy')}</button></div>`; $('[data-copy-inv]')?.addEventListener('click', () => copy(r.link)); });
}

// ====================== ИНВЕСТОРАМ ======================
export async function viewInvestors(el) {
  const r = await call('GET', '/investors');
  el.innerHTML = `<div class="page-head"><div><h1>Инвесторам</h1><p>Витрина для наблюдателей: только агрегированные цифры, без персональных данных лидов. Пригласите инвестора с ролью «Наблюдатель» — он увидит этот раздел и аналитику, но не карточки клиентов.</p></div><span class="tag">на ${fmtDate(r.asOf)}</span></div>
    <div class="grid g4"><div class="card kpi"><span class="label">Выручка</span><b>${money(r.revenueRub, { usd: false })}</b><span class="usd">${usd(r.revenueRub)}</span></div><div class="card kpi"><span class="label">Открытые сделки</span><b>${money(r.pipelineRub, { usd: false })}</b></div><div class="card kpi"><span class="label">Сделок закрыто</span><b>${r.dealsWon}</b></div><div class="card kpi"><span class="label">Лид → встреча</span><b>${pct(r.conversion.leadToMeeting)}</b></div></div>
    <div class="grid g2">
      <div class="card"><h3>Целостность данных ${hint('Каждое важное действие записывается в журнал, где хеш записи зависит от предыдущей, как в блокчейне. Задним числом исправить цифры нельзя: проверка покажет разрыв цепочки.')}</h3>
        ${r.integrity ? `<p>${r.integrity.ok ? '<span class="tag ok">цепочка цела</span>' : `<span class="tag bad">разрыв на записи ${r.integrity.brokenAt}</span>`} записей: ${r.integrity.entries}</p><p class="xs mute mono" style="word-break:break-all">head: ${esc(r.integrity.head || '')}</p><p class="xs mute">Хеш можно периодически публиковать (в Telegram-канале для инвесторов или через OpenTimestamps в блокчейне Bitcoin) — тогда подменить историю нельзя даже владельцу.</p>` : '<p class="small mute">Журнал целостности доступен в серверной версии.</p>'}</div>
      <div class="card"><h3>Модель SaaS (базовый сценарий)</h3><div class="grid g3 small"><div><span class="label">MRR</span><br><b>${money(r.model.mrrRub)}</b></div><div><span class="label">ARR</span><br><b>${money(r.model.arrRub)}</b></div><div><span class="label">LTV/CAC</span><br><b>${r.model.ltvToCac}</b></div></div><p class="xs mute">20 клиентов × (39 900 ₽ абонентка + 8 000 ₽ кредиты), отток 6% в месяц. Пересчитайте свой сценарий в разделе «Аналитика».</p></div>
    </div>`;
}

// ====================== БЕЗОПАСНОСТЬ ======================
export async function viewSecurity(el) {
  const server = S.api.mode === 'server';
  const [verify, auditRows, backups] = await Promise.all([
    call('GET', '/audit/verify'),
    call('GET', '/audit?limit=30').catch(() => []),
    server ? call('GET', '/backups').catch(() => null) : null,
  ]);
  el.innerHTML = `<div class="page-head"><div><h1>Безопасность</h1><p>Защита от потери данных, кражи доступа и тихих правок задним числом.</p></div></div>
    <div class="grid g2">
      <div class="card"><h3>Вход</h3><ul class="facts small"><li>Пароли — хеш scrypt, без хранения в открытом виде.</li><li>Сессия в HttpOnly-cookie, защита от CSRF, ограничение попыток входа.</li><li>Роли: владелец, менеджер, клиент, наблюдатель. Сотрудник видит только свой кабинет.</li></ul>
        ${server ? `<div class="row"><button class="btn" id="totp-setup">Включить 2FA</button><button class="btn" id="logout-all">Выйти на всех устройствах</button><button class="btn" id="pw-change">Сменить пароль</button></div><div id="totp-box"></div>` : '<p class="small mute">В демо вход имитируется. На сервере здесь включается двухфакторный вход (Google Authenticator, Яндекс Ключ).</p>'}</div>
      <div class="card"><h3>Бэкапы</h3>${server && backups ? `<p class="small">Автоматически каждые ${backups.everyHours} ч, хранится ${backups.keep} последних. Файлы зашифрованы AES-256-GCM мастер-ключом.</p><div class="list">${backups.backups.slice(0, 5).map(x => `<div class="item"><div class="body mono small">${esc(x.name)}</div><span class="small mute">${Math.round(x.bytes / 1024)} КБ</span></div>`).join('') || '<p class="small mute">Пока нет.</p>'}</div><div class="row"><button class="btn" id="backup-now">Сделать бэкап сейчас</button><a class="btn" href="/api/export">Выгрузить данные (JSON)</a></div><p class="xs mute">Копируйте папку data/backups во внешнее хранилище (S3, Яндекс Облако). Мастер-ключ храните отдельно — без него бэкап не расшифровать.</p>` : '<p class="small mute">В демо данные хранятся только в этом браузере. Серверная версия делает зашифрованные бэкапы по расписанию.</p><button class="btn" id="demo-export">Скачать снимок демо (JSON)</button>'}</div>
    </div>
    <div class="card"><div class="card-head"><h3>Журнал целостности</h3><span>${verify.ok ? '<span class="tag ok">цепочка цела</span>' : `<span class="tag bad">разрыв на записи ${verify.brokenAt}</span>`} <span class="small mute">записей: ${verify.entries}</span></span></div>
      ${auditRows.length ? `<div class="table-wrap"><table><thead><tr><th>Когда</th><th>Действие</th><th>Хеш</th></tr></thead><tbody>${auditRows.map(r => `<tr><td class="small">${fmtDate(r.at)}</td><td class="small">${esc(r.action)}</td><td class="mono xs mute">${esc(String(r.hash).slice(0, 16))}…</td></tr>`).join('')}</tbody></table></div>` : `<p class="small mute">${esc(verify.note || 'Нет записей.')}</p>`}</div>
    <div class="card"><h3>Что ещё защищает бизнес</h3><ul class="facts small">
      <li>Ключи API и пароли почты зашифрованы; сотрудник с ролью «Менеджер» их не видит и не может выгрузить базу.</li>
      <li>Отписка срабатывает сразу и блокирует любые касания: это защищает домен и репутацию.</li>
      <li>Отправка с личных аккаунтов (Telegram, WhatsApp) — только вручную через подготовленный текст: без ботов, которые банят.</li>
      <li>Загрузка внешних страниц защищена от SSRF: система не ходит во внутренние адреса.</li>
      <li>Полная выгрузка — только владельцу, каждое действие записывается в журнал.</li></ul></div>`;
  $('#backup-now')?.addEventListener('click', async () => { const r = await act(() => call('POST', '/backups')); if (r) { toast('Бэкап: ' + r.file); S.render(); } });
  $('#logout-all')?.addEventListener('click', async () => { await act(() => S.api.auth.logoutAll(), 'Все сессии завершены'); location.reload(); });
  $('#totp-setup')?.addEventListener('click', async () => {
    const r = await act(() => S.api.auth.totpSetup()); if (!r) return;
    $('#totp-box').innerHTML = `<p class="small">Добавьте ключ в приложение-аутентификатор вручную:</p><div class="code">${esc(r.secret)}</div><p class="xs mute" style="word-break:break-all">${esc(r.otpauth)}</p><div class="row"><input id="totp-code" placeholder="Код из приложения" style="max-width:180px"><button class="btn primary" id="totp-on">Подтвердить</button></div>`;
    $('#totp-on').addEventListener('click', async () => { await act(() => S.api.auth.totpEnable($('#totp-code').value), '2FA включена'); });
  });
  $('#pw-change')?.addEventListener('click', () => modal(`<h3>Смена пароля</h3><label class="field"><span>Текущий</span><input type="password" id="pw-old"></label><label class="field"><span>Новый (от 10 символов)</span><input type="password" id="pw-new"></label><div class="row" style="justify-content:flex-end"><button class="btn" data-close>Отмена</button><button class="btn primary" id="pw-go">Сменить</button></div>`, { onMount(m, close) { m.querySelector('#pw-go').addEventListener('click', async () => { const r = await act(() => S.api.auth.password({ old: m.querySelector('#pw-old').value, password: m.querySelector('#pw-new').value }), 'Пароль изменён, войдите заново'); if (r) { close(); location.reload(); } }); } }));
  $('#demo-export')?.addEventListener('click', () => { const data = S.api.exportSnapshot?.(); if (data) modal(`<h3>Снимок демо</h3><p class="small mute">Скопируйте JSON — это все данные демо-кабинета.</p><textarea class="tall mono" readonly>${esc(data)}</textarea><div class="row"><button class="btn" id="cp-snap">${icon('copy')}Скопировать</button><button class="btn" data-close>Закрыть</button></div>`, { onMount(m) { m.querySelector('#cp-snap').addEventListener('click', () => copy(data)); } }); });
}

// ====================== НАСТРОЙКИ ======================
export async function viewPrefs(el) {
  const s = await call('GET', '/settings');
  el.innerHTML = `<div class="page-head"><div><h1>Настройки</h1><p>Ваш профиль, офферы и цены, правила отправки, поиск на hh.ru.</p></div></div>
    <form class="card" id="p-me" data-tour="prefs-me"><h3>Отправитель</h3><div class="form-grid">
      <label class="field"><span>Имя</span><input id="p-name" name="name" value="${esc(s.me.name)}"></label><label class="field"><span>Должность / позиционирование</span><input id="p-title" name="title" value="${esc(s.me.title)}"></label>
      <label class="field"><span>Telegram</span><input id="p-tg" name="telegram" value="${esc(s.me.telegram)}"></label><label class="field"><span>Email</span><input id="p-email" name="email" value="${esc(s.me.email)}"></label>
      <label class="field"><span>Курс доллара, ₽ ${hint('Используется для сумм в скобках. На сервере можно подтянуть курс ЦБ кнопкой.')}</span><input id="p-usd" name="usdRate" type="number" step="0.01" value="${s.usdRate}"></label></div>
      <label class="field"><span>Подпись (пусто — сгенерируется)</span><textarea id="p-sign" name="signature" rows="3">${esc(s.me.signature)}</textarea></label>
      <label class="field"><span>Как я пишу ${hint('Вставьте 3–5 своих сообщений клиентам. Claude будет держать ваш голос, а шаблоны подстроятся под собеседника.')}</span><textarea id="p-sample" name="mySample" rows="4">${esc(s.me.mySample)}</textarea></label>
      ${s.me.myStyle?.ok ? `<p class="small">Ваш стиль: <b>${esc(s.me.myStyle.summary)}</b></p>` : ''}
      <div class="row"><button class="btn primary" type="submit">Сохранить</button>${S.api.mode === 'server' ? '<button class="btn" type="button" id="p-fx">Курс ЦБ</button>' : ''}</div></form>
    <form class="card" id="p-offers"><div class="card-head"><h3>Офферы и цены</h3>${hint('Эти продукты попадают в скрипт встречи, сделки и A/B. Цены — в рублях, доллары считаются автоматически.')}</div>
      <div class="table-wrap"><table><thead><tr><th>Название</th><th class="n">Цена, ₽</th><th>Описание</th></tr></thead><tbody>${s.offers.map((o, i) => `<tr><td><input id="o-name-${i}" data-o="${i}" data-k="name" value="${esc(o.name)}"></td><td style="width:140px"><input id="o-price-${i}" data-o="${i}" data-k="priceRub" type="number" value="${o.priceRub}"></td><td><input id="o-desc-${i}" data-o="${i}" data-k="desc" value="${esc(o.desc)}"></td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn primary" type="submit">Сохранить офферы</button></div></form>
    <form class="card" id="p-send" data-tour="prefs-send"><div class="card-head"><h3>Правила отправки писем</h3>${hint('Новый ящик начинает с малого и добавляет письма каждый день — это прогрев. Пауза между письмами и рабочее окно делают отправку похожей на работу человека и берегут репутацию домена.')}</div><div class="form-grid">
      ${num('dailyCap', 'Лимит в день', s.sending.dailyCap)}${num('warmupStart', 'Прогрев: старт', s.sending.warmupStart)}${num('warmupStep', 'Прогрев: +в день', s.sending.warmupStep)}${num('windowFrom', 'Окно с, ч', s.sending.windowFrom)}${num('windowTo', 'Окно до, ч', s.sending.windowTo)}${num('minGapSec', 'Пауза от, сек', s.sending.minGapSec)}${num('maxGapSec', 'Пауза до, сек', s.sending.maxGapSec)}</div>
      <label class="switch"><input type="checkbox" id="s-wd" name="weekdaysOnly" ${s.sending.weekdaysOnly ? 'checked' : ''}> Только будни</label>
      <p class="xs mute">Обязательно до первой рассылки: свой домен, SPF, DKIM и DMARC; ящик на имя человека; plain-text без вложений. Подробно — в docs/DELIVERABILITY.md.</p>
      <div class="row"><button class="btn primary" type="submit">Сохранить</button></div></form>
    <form class="card" id="p-auto" data-tour="prefs-auto"><div class="card-head"><h3>Автопилот, время и лимиты</h3>${hint('Автопилот утром готовит касания и пишет вам фокус дня в Telegram-бот, вечером закрывает молчащих (правило «нет ответа N дней = отказ») и присылает итог. Лимиты в день берегут аккаунты от блокировок.')}</div>
      <label class="switch"><input type="checkbox" id="a-on" name="enabled" ${s.autopilot?.enabled ? 'checked' : ''}> Автопилот включён</label>
      <div class="form-grid">
        ${num('morningHour', 'Утренний запуск, ч', s.autopilot?.morningHour ?? 8)}${num('eveningHour', 'Вечерний разбор, ч', s.autopilot?.eveningHour ?? 20)}${num('dailyNew', 'Новых лидов с hh в день', s.autopilot?.dailyNew ?? 20)}${num('prepare', 'Готовить касаний в день', s.autopilot?.prepare ?? 20)}${num('minScore', 'Мин. оценка вакансии', s.autopilot?.minScore ?? 45)}${num('noReplyDays', 'Нет ответа N дней = отказ', s.autopilot?.noReplyDays ?? 3)}
        <label class="field"><span>Ваш часовой пояс</span><input id="a-tz" name="tzMine" value="${esc(s.tz?.mine || 'Asia/Ho_Chi_Minh')}"></label>
        <label class="field"><span>Пояс клиентов</span><input id="a-tzc" name="tzClients" value="${esc(s.tz?.clients || 'Europe/Moscow')}"></label>
        ${['telegram', 'whatsapp', 'zalo', 'hh_apply', 'hh_chat'].map(k => num('cap_' + k, 'Лимит в день: ' + ({ telegram: 'Telegram', whatsapp: 'WhatsApp', zalo: 'Zalo', hh_apply: 'отклики hh', hh_chat: 'чат hh' })[k], s.caps?.[k] ?? '')).join('')}
      </div>
      <label class="switch"><input type="checkbox" id="a-res" name="autoResearch" ${s.autopilot?.autoResearch !== false ? 'checked' : ''}> Исследовать компании автоматически (1 кредит за лида)</label>
      <div class="row"><button class="btn primary" type="submit">Сохранить</button></div></form>
    <form class="card" id="p-hh" data-tour="prefs-hh"><div class="card-head"><h3>Фильтры hh.ru и ваш отклик</h3>${hint('Стоп-факторы из вашей CRM: конкуренты, ниши без трафика, зарплата ниже порога. Ваш текст отклика хранится только в вашей базе. Подстановки: [должность], [компания].')}</div>
      <div class="form-grid">
        <label class="field"><span>Ниши ядра</span><input id="h-core" name="coreKeywords" value="${esc((s.hh.coreKeywords || []).join(', '))}"></label>
        <label class="field"><span>Стоп-ниши</span><input id="h-stop" name="stopNiches" value="${esc((s.hh.stopNiches || []).join(', '))}"></label>
        <label class="field"><span>Конкуренты</span><input id="h-comp" name="competitors" value="${esc((s.hh.competitors || []).join(', '))}"></label>
        <label class="field"><span>Мин. зарплата, ₽</span><input type="number" id="h-min" name="minSalary" value="${s.hh.minSalary ?? 120000}"></label>
        <label class="field"><span>ID резюме для откликов</span><input id="h-res" name="resumeId" value="${esc(s.hh.resumeId || '')}"></label>
      </div>
      <label class="field"><span>Ваш текст отклика (пусто — честный шаблон системы)</span><textarea id="h-letter" name="hhLetter" rows="5" placeholder="Здравствуйте! Откликаюсь на вакансию [должность]...">${esc(s.playbook?.hhLetter || '')}</textarea></label>
      <div class="row"><button class="btn primary" type="submit">Сохранить</button></div></form>
    <div class="card"><h3>Демо и обучение</h3><div class="row"><button class="btn" id="p-tour">Пройти обучение заново</button>${S.api.mode === 'demo' ? '<button class="btn danger" id="p-reset">Сбросить демо-данные</button>' : ''}</div></div>`;
  $('#p-me').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); await act(() => call('PUT', '/settings', { me: { name: f.name, title: f.title, telegram: f.telegram, email: f.email, signature: f.signature, mySample: f.mySample }, usdRate: Number(f.usdRate) || 92 }), 'Сохранено'); await refreshBoot(); S.render(); });
  $('#p-offers').addEventListener('submit', async (e) => { e.preventDefault(); const os = structuredClone(s.offers); $$('#p-offers [data-o]').forEach(i => { os[+i.dataset.o][i.dataset.k] = i.dataset.k === 'priceRub' ? Number(i.value) || 0 : i.value; }); await act(() => call('PUT', '/settings', { offers: os }), 'Офферы сохранены'); await refreshBoot(); });
  $('#p-send').addEventListener('submit', async (e) => { e.preventDefault(); const f = formData(e.target); await act(() => call('PUT', '/settings', { sending: f }), 'Правила отправки сохранены'); });
  const csv = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  $('#p-auto').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target);
    const caps = {}; for (const k of ['telegram', 'whatsapp', 'zalo', 'hh_apply', 'hh_chat']) if (f['cap_' + k] !== '' && f['cap_' + k] != null) caps[k] = Number(f['cap_' + k]);
    await act(() => call('PUT', '/settings', { autopilot: { enabled: f.enabled, morningHour: f.morningHour, eveningHour: f.eveningHour, dailyNew: f.dailyNew, prepare: f.prepare, minScore: f.minScore, noReplyDays: f.noReplyDays, autoResearch: f.autoResearch }, tz: { mine: f.tzMine, clients: f.tzClients }, caps }), 'Автопилот и лимиты сохранены');
    await refreshBoot();
  });
  $('#p-hh').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = formData(e.target);
    await act(() => call('PUT', '/settings', { hh: { coreKeywords: csv(f.coreKeywords), stopNiches: csv(f.stopNiches), competitors: csv(f.competitors), minSalary: Number(f.minSalary) || 0, resumeId: f.resumeId }, playbook: { hhLetter: f.hhLetter } }), 'Фильтры и отклик сохранены');
    await refreshBoot();
  });
  $('#p-fx')?.addEventListener('click', async () => { const r = await act(() => call('GET', '/fx')); if (r) { $('#p-usd').value = r.usdRate; toast('Курс ЦБ: ' + r.usdRate + ' ₽'); } });
  $('#p-tour').addEventListener('click', async () => { const { startTour } = await import('./tour.js'); startTour(); });
  $('#p-reset')?.addEventListener('click', async () => { const { ask } = await import('./ui.js'); if (await ask('Сбросить все демо-данные и заново построить тестовую воронку?', { ok: 'Сбросить', danger: true })) { await S.api.reset(); location.hash = '#dashboard'; location.reload(); } });
}
const num = (k, l, v) => `<label class="field"><span>${esc(l)}</span><input type="number" id="s-${k}" name="${k}" value="${v}"></label>`;

// ====================== ПАМЯТКА ======================
export function catSvg() {
  return `<svg class="cat" viewBox="0 0 200 170" role="img" aria-label="Кот-охранник">
    <path d="M40 150c0-45 25-70 60-70s60 25 60 70z" fill="var(--brand-soft)" stroke="var(--ink)" stroke-width="3"/>
    <path d="M58 92L48 42l34 28M142 92l10-50-34 28" fill="var(--surface)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="100" cy="100" r="44" fill="var(--surface)" stroke="var(--ink)" stroke-width="3"/>
    <rect x="70" y="86" width="24" height="12" rx="4" fill="var(--ink)"/><rect x="106" y="86" width="24" height="12" rx="4" fill="var(--ink)"/><path d="M94 91h12" stroke="var(--ink)" stroke-width="3"/>
    <path d="M96 108l4 4 4-4" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><path d="M92 118c4 4 12 4 16 0" fill="none" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 110h22M60 118h20M118 110h22M120 118h20" stroke="var(--mute)" stroke-width="2" stroke-linecap="round"/>
    <path d="M84 150l16-18 16 18" fill="var(--brand)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

export function fraudMemoHtml(short = false) {
  const items = [
    ['Никому не называйте коды из СМС и пуш-уведомлений', 'Ни «службе безопасности банка», ни «Госуслугам», ни «полиции». Настоящие сотрудники коды не спрашивают никогда.'],
    ['Звонок из «банка» или «ФСБ» — повод положить трубку', 'Перезвоните сами по номеру с обратной стороны карты или с официального сайта.'],
    ['Госуслуги — только gosuslugi.ru', 'Проверяйте адрес в строке браузера. Ссылки из мессенджеров на «вход в Госуслуги» почти всегда фишинг.'],
    ['«Безопасный счёт» не существует', 'Любая просьба перевести деньги «для сохранности» — мошенничество.'],
    ['Не устанавливайте приложения по просьбе звонящего', 'Программы удалённого доступа отдают ваш телефон и банк чужому человеку.'],
    ['Деловая почта: проверяйте реквизиты голосом', 'Письмо «у нас сменился счёт» от партнёра подтвердите звонком по известному номеру.'],
    ['Включите двухфакторный вход', 'В почте, Telegram и здесь, в LEADMEET OS. Пароль от почты — уникальный.'],
  ];
  const list = short ? items.slice(0, 4) : items;
  return `<ul class="facts">${list.map(([t, d]) => `<li><span><b>${esc(t)}.</b> ${esc(d)}</span></li>`).join('')}</ul>${short ? '' : '<p class="small mute">Если сомневаетесь — сделайте паузу. Мошенники всегда торопят. Горячая линия ЦБ: 8 800 300-30-00.</p>'}`;
}

export async function viewMemo(el) {
  el.innerHTML = `<div class="page-head"><div><h1>Памятка с котиком</h1><p>Кот охраняет ваш бизнес и ваших клиентов от мошенников. Отправьте эту памятку команде и тем, кому продаёте.</p></div></div>
    <div class="split"><div class="card" style="align-items:center">${catSvg()}<p class="small mute" style="text-align:center">«Мяу. Коды из СМС — только мне. А мне они не нужны».</p></div>
    <div class="card"><h3>Семь правил</h3>${fraudMemoHtml(false)}<div><button class="btn" id="memo-copy">${icon('copy')}Скопировать памятку</button></div></div></div>`;
  $('#memo-copy').addEventListener('click', () => copy([...el.querySelectorAll('.facts li')].map(li => '• ' + li.textContent.trim()).join('\n')));
}

export { refreshBoot };
