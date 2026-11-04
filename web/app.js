// Оболочка приложения: вход, меню, маршрутизация по #хешу, тур.
import { S, call, act, refreshBoot, go, idFromHash } from './state.js';
import { esc, icon, toast, modal, bindHints, $, $$ } from './ui.js';
import { viewDashboard, viewSignals, viewLeads, viewLead } from './views-main.js';
import { viewMeetings, viewScript, viewCalls, viewExperiments, viewAnalytics } from './views-sales.js';
import { viewChannels, viewCabinets, viewInvestors, viewSecurity, viewPrefs, viewMemo, catSvg, fraudMemoHtml } from './views-admin.js';
import { startTour } from './tour.js';
import { viewQueue, viewForecast, viewLaunch, viewPack } from './views-flow.js';
import { startGalaxy, startTips } from './galaxy.js';
import { viewSources, viewHarvey, viewHypotheses } from './views-growth.js';
import { openFaq } from './faq.js';

// Реферальный код из ссылки агента (?ref=КОД) — запоминаем до регистрации.
function refCode() {
  const r = new URLSearchParams(location.search).get('ref');
  try { if (r && /^[A-Z0-9]{4,12}$/.test(r)) localStorage.setItem('lm-ref', r); return r || localStorage.getItem('lm-ref') || ''; } catch { return r || ''; }
}

/** Логотип: созвездие — сигнал (голубой) связан с собственником (золотой). */
export function logoSvg(size = 30) {
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#0b1f3a"/><path d="M7 22 L13 11 L20 17 L25 8" stroke="#5aa9ff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path d="M13 11 L25 8" stroke="#5aa9ff" stroke-width="1" opacity=".45"/><circle cx="7" cy="22" r="2.6" fill="#5adcff"/><circle cx="13" cy="11" r="1.7" fill="#d2e1ff"/><circle cx="20" cy="17" r="1.7" fill="#d2e1ff"/><circle cx="25" cy="8" r="3.2" fill="#ffcd6e"/></svg>`;
}

const AUTH_TIPS = [
  'Пока вакансия РОПа открыта, продажи болят у собственника каждый день — это ваше окно для разговора.',
  'Пишите собственнику его словами: система разбирает стиль его постов — длину фраз, эмодзи, обращение.',
  'Капчу hh.ru вводит человек: приложение пришлёт ссылку на телефон, обходить защиту не нужно.',
  'Утро — 15 минут в «Конвейере»: скопировать → открыть чат → «Отправлено». Остальное делает автопилот.',
  'Цифры в письме — только из карточки лида и ваших кейсов. Оценщик подсветит всё, что не подтверждено.',
  'Голубые точки вокруг — сигналы. Золотые — собственники. Коснитесь экрана, чтобы запустить импульс.',
  '«Харви: почта» ищет компании на картах и пишет 2 коротких письма: второе — только если нет ответа.',
  'Сравнивайте заходы: A/B покажет, какой первый абзац приводит на встречу, а не просто к ответу.',
  'Перед встречей откройте скрипт: вопросы о цифрах, цене бездействия и следующем шаге уже собраны.',
  'Загрузите запись звонка — разбор покажет, где вы говорили больше клиента и какой вопрос пропустили.',
  'Кредиты тратятся только на работу: исследование — 1, письмо от Claude — 2, разбор звонка — 5.',
  'Цены можно показать клиенту в тенге, донгах, юанях или дирхамах — по курсу ЦБ.',
  'Кнопка «Стать агентом» даёт личную ссылку: процент с оплат приведённых кабинетов.',
  'Наклоните телефон — галактика повернётся следом.',
  'Где-то в углу мерцает звезда. За ней — тайная библиотека ответов на пяти языках.',
  'Госуслуги живут только на gosuslugi.ru. Кот на соседней кнопке это подтвердит.',
];

const NAV = [
  { id: 'dashboard', name: 'Пульт', icon: 'home' },
  { id: 'queue', name: 'Конвейер', icon: 'send', count: 'queue' },
  { id: 'signals', name: 'Поиск лидов', icon: 'radar' },
  { id: 'sources', name: 'Где искать клиентов', icon: 'search' },
  { id: 'harvey', name: 'Харви: почта', icon: 'mail' },
  { id: 'leads', name: 'Лиды', icon: 'users', count: 'leads' },
  { id: 'meetings', name: 'Встречи', icon: 'calendar', count: 'meetings' },
  { id: 'calls', name: 'Разбор звонков', icon: 'mic' },
  { id: 'experiments', name: 'A/B заходов', icon: 'flask' },
  { id: 'analytics', name: 'Аналитика и деньги', icon: 'chart' },
  { id: 'forecast', name: 'Что даст 100', icon: 'spark' },
  { id: 'hypotheses', name: 'Гипотезы и рынки', icon: 'flask' },
  { sep: 'Система' },
  { id: 'launch', name: 'Мастер запуска', icon: 'check' },
  { id: 'pack', name: 'Упаковка профиля', icon: 'file' },
  { id: 'channels', name: 'Каналы', icon: 'plug' },
  { id: 'cabinets', name: 'Кабинеты и тарифы', icon: 'layers' },
  { id: 'investors', name: 'Инвесторам', icon: 'eye' },
  { id: 'security', name: 'Безопасность', icon: 'shield' },
  { id: 'prefs', name: 'Настройки', icon: 'sliders' },
  { id: 'memo', name: 'Памятка с котиком', icon: 'cat' },
];
const VIEWS = { sources: viewSources, harvey: viewHarvey, hypotheses: viewHypotheses, queue: viewQueue, forecast: viewForecast, launch: viewLaunch, pack: viewPack, dashboard: viewDashboard, signals: viewSignals, leads: viewLeads, lead: viewLead, meetings: viewMeetings, script: viewScript, calls: viewCalls, experiments: viewExperiments, analytics: viewAnalytics, channels: viewChannels, cabinets: viewCabinets, investors: viewInvestors, security: viewSecurity, prefs: viewPrefs, memo: viewMemo };
const OBSERVER_VIEWS = ['investors', 'analytics', 'memo', 'forecast', 'hypotheses'];

export async function boot(api) {
  S.api = api;
  bindHints();
  applyTheme();
  window.addEventListener('leadmeet:logout', () => renderAuth());
  try { await refreshBoot(); }
  catch (e) { if (e.status === 401 || e.status === undefined) return renderAuth(); toast(e.message, 'bad'); return renderAuth(); }
  renderShell();
}

function applyTheme() {
  try { const t = localStorage.getItem('lm-theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* storage may be blocked */ }
}
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('lm-theme', root.dataset.theme); } catch { /* ignore */ }
}

// ---------------- auth ----------------
async function renderAuth(mode = 'login') {
  const st = await S.api.auth.state().catch(() => ({ hasUsers: true, allowSignup: false, demoMode: false, oauth: {} }));
  if (!st.hasUsers) mode = 'register';
  const app = document.getElementById('app');
  const inviteToken = (location.hash.match(/^#invite=([\w-]+)/) || [])[1] || '';
  if (inviteToken) mode = 'register';
  const sso = (id, label, color, letter) => `<button class="btn" type="button" data-sso="${id}" data-tour="sso-${id}"><i style="background:${color}">${letter}</i>${label}</button>`;
  app.innerHTML = `
  <div class="auth galaxy-page">
    <canvas class="galaxy" aria-hidden="true"></canvas>
    <button class="secret-star" type="button" id="secret-star" aria-label="Тайная библиотека: ответы на вопросы на пяти языках" title="✦">✦</button>
    <section class="auth-side">
      <div class="float-layer">
        <div class="brand" id="auth-brand">${logoSvg()}<span>LEADMEET OS<small style="color:inherit;opacity:.7">встречи с собственниками бизнеса</small></span></div>
        <h1 class="h4u">Встречи с собственниками на чек от <span class="glow">200&nbsp;000&nbsp;₽</span> — пока их вакансия РОПа ещё открыта</h1>
        <p class="lead-in">Собственник ищет руководителя продаж — значит, продажи болят у него <b>сегодня</b>. LEADMEET ловит этот момент на площадках вакансий, картах и в открытых данных, изучает компанию и пишет собственнику так, как пишет он сам.</p>
        <ol class="orbit">
          <li><b>Ловим момент</b><span>вакансия РОПа или коммерческого директора = открытая боль</span></li>
          <li><b>Знаем всё до письма</b><span>сайт, ЕГРЮЛ, Telegram-канал и манера собственника</span></li>
          <li><b>Пишем его словами</b><span>коротко, с фактами о его компании, без шаблонов</span></li>
          <li><b>Ведём к встрече</b><span>ответ → слот в календаре → скрипт продающего интервью</span></li>
          <li><b>Доводим до сделки</b><span>разбор записи звонка и следующий шаг</span></li>
        </ol>
        <div class="platforms" aria-label="Где ищем клиентов">${['hh.ru', 'hh.kz', 'Работа России', 'SuperJob', 'Авито Работа', '2ГИС', 'Яндекс Карты', 'Google Maps', 'ЕГРЮЛ', 'сайты компаний', 'Telegram-чаты', 'реклама'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="guarantee"><b>Гарантия: нет встреч с собственниками за 30 дней — вернём оплату</b><span class="small">Старт без оплаты: демо-кабинет с тестовой воронкой за 2 минуты, без карты.</span></div>
        <p class="proof small">Из практики: 29&nbsp;360 откликов → 11 менеджеров на плане, 13&nbsp;928&nbsp;₽ за менеджера.</p>
        <div class="tips" id="auth-tips" tabindex="0" role="button" aria-label="Совет. Нажмите, чтобы показать следующий"></div>
      </div>
    </section>
    <section class="auth-main">
      <form class="auth-box" id="auth-form" autocomplete="on">
        <div><h2>${mode === 'register' ? (st.hasUsers ? 'Регистрация' : 'Создайте кабинет владельца') : 'Вход'}</h2>
        <p class="mute small" style="margin-top:6px">${mode === 'register' ? (st.hasUsers ? 'Новый кабинет с пробными кредитами.' : 'Первый пользователь становится владельцем системы.') : 'Рабочий кабинет LEADMEET.'}</p></div>
        <div class="sso">
          ${sso('google', 'Google', '#4285f4', 'G')}${sso('yandex', 'Яндекс ID', '#fc3f1d', 'Я')}
          ${sso('vk', 'VK ID', '#0077ff', 'VK')}${sso('gosuslugi', 'Госуслуги', '#0d4cd3', 'Г')}
        </div>
        <div class="or">или по почте</div>
        ${mode === 'register' ? '<label class="field"><span>Имя</span><input id="a-name" name="name" autocomplete="name" placeholder="Влад Лев"></label>' : ''}
        <label class="field"><span>Email</span><input id="a-email" name="email" type="email" autocomplete="email" required placeholder="you@company.ru"></label>
        <label class="field"><span>Пароль</span><input id="a-pass" name="password" type="password" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" required minlength="${mode === 'register' ? 10 : 1}" placeholder="${mode === 'register' ? 'минимум 10 символов, буквы и цифры' : ''}"></label>
        <label class="field" id="totp-field" hidden><span>Код из приложения (2FA)</span><input id="a-totp" name="totp" inputmode="numeric" autocomplete="one-time-code" placeholder="123456"></label>
        <button class="btn primary" type="submit">${mode === 'register' ? 'Создать кабинет' : 'Войти'}</button>
        ${st.demoMode ? '<button class="btn" type="button" id="demo-login" data-tour="demo-login">Открыть демо-кабинет с тестовой воронкой</button>' : ''}
        ${st.hasUsers && (st.allowSignup || mode === 'register') ? `<button class="btn ghost" type="button" id="switch-mode">${mode === 'register' ? 'Уже есть аккаунт — войти' : 'Создать аккаунт'}</button>` : ''}
        <p class="xs mute">Пароли хранятся только в виде хеша scrypt. Можно включить двухфакторный вход.</p>
      </form>
    </section>
  </div>`;
  const gal = startGalaxy(app.querySelector('.galaxy'), { onParallax: (x, y) => { const f = app.querySelector('.float-layer'); if (f) f.style.transform = `translate3d(${(x * -12).toFixed(1)}px, ${(y * -9).toFixed(1)}px, 0)`; } });
  startTips($('#auth-tips'), AUTH_TIPS);
  $('#secret-star').addEventListener('click', openFaq);
  let taps = 0, tapT = 0;
  $('#auth-brand').addEventListener('click', () => { clearTimeout(tapT); if (++taps >= 3) { taps = 0; openFaq(); } tapT = setTimeout(() => { taps = 0; }, 600); });
  const onQ = (e) => { if (!document.querySelector('.galaxy')) return document.removeEventListener('keydown', onQ); if (e.key === '?' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) openFaq(); };
  document.addEventListener('keydown', onQ);
  void gal;
  const form = $('#auth-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { email: $('#a-email').value, password: $('#a-pass').value, name: $('#a-name')?.value, totp: $('#a-totp').value, invite: inviteToken, ref: refCode() };
    try {
      const r = mode === 'register' ? await S.api.auth.register(body) : await S.api.auth.login(body);
      if (r.needTotp) { $('#totp-field').hidden = false; $('#a-totp').focus(); return; }
      if (inviteToken) history.replaceState(null, '', location.pathname);
      await refreshBoot(); renderShell();
    } catch (err) { toast(err.message, 'bad'); }
  });
  $('#switch-mode')?.addEventListener('click', () => renderAuth(mode === 'register' ? 'login' : 'register'));
  $('#demo-login')?.addEventListener('click', async () => { try { await S.api.auth.demo(); await refreshBoot(); renderShell(); } catch (err) { toast(err.message, 'bad'); } });
  $$('[data-sso]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.sso;
    if (id === 'gosuslugi') return gosuslugiJoke();
    if (S.api.mode === 'demo') return toast(`В демо вход через ${b.textContent.trim()} имитируется: нажмите «Открыть демо-кабинет». На сервере кнопка ведёт на настоящий OAuth.`);
    if (!st.oauth?.[id]) return toast(`Вход через ${b.textContent.trim()} ещё не настроен: добавьте ключи приложения в .env (см. docs/SETUP.md).`, 'bad');
    location.href = `/api/auth/oauth/${id}`;
  }));
}

function gosuslugiJoke() {
  modal(`${catSvg()}<h2 style="text-align:center">Мяу. Это не Госуслуги.</h2>
    <p style="text-align:center">Кот проверил: настоящие Госуслуги живут только на <b>gosuslugi.ru</b>, и они никогда не просят войти через сторонние сайты. Сюда входите по почте или через Google, Яндекс или VK.</p>
    ${fraudMemoHtml(true)}
    <div class="row" style="justify-content:center"><button class="btn primary" data-close>Понял, мяу</button></div>`);
}

// ---------------- shell ----------------
function renderShell() {
  const b = S.boot;
  const app = document.getElementById('app');
  const isObserver = b.role === 'observer';
  const OWNER_ONLY = ['channels', 'cabinets', 'security', 'prefs', 'launch', 'pack'];
  const nav = NAV.filter(n => n.sep || (isObserver ? OBSERVER_VIEWS.includes(n.id) : (b.role === 'owner' || !OWNER_ONLY.includes(n.id))));
  app.innerHTML = `
  <div class="shell">
    <aside class="rail" id="rail" data-tour="rail">
      <div class="brand">${logoSvg()}<span>LEADMEET OS<small>${esc(b.ws.name)}</small></span></div>
      <nav class="nav" aria-label="Разделы">
        ${nav.map(n => n.sep ? `<div class="label nav-sep">${n.sep}</div>` : `<a href="#${n.id}" data-nav="${n.id}" data-tour="nav-${n.id}">${icon(n.icon)}<span>${n.name}</span>${n.count ? `<span class="cnt" data-count="${n.count}"></span>` : ''}</a>`).join('')}
      </nav>
      <div class="rail-foot">
        <div class="credits" data-tour="credits"><span>Кредиты</span><b id="credit-count">${b.ws.credits ?? 0}</b></div>
        <div class="xs mute" style="padding:0 4px">${esc(b.user?.email || '')} · ${esc(b.roleName || '')}</div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="btn ghost menu-btn" id="menu-btn" aria-label="Меню">${icon('menu')}</button>
        <div class="grow row" style="flex-wrap:nowrap;min-width:0">
          <select id="ws-switch" aria-label="Кабинет" style="max-width:240px" data-tour="ws-switch">${(b.workspaces || []).map(w => `<option value="${esc(w.id)}" ${w.id === b.ws.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select>
          ${b.llm ? '<span class="tag ok hide-sm">Claude подключён</span>' : '<span class="tag hide-sm" title="Работает шаблонный движок. Ключ Claude — в разделе Каналы.">шаблонный движок</span>'}
        </div>
        <button class="btn ghost" id="tour-btn" data-tour="tour-btn">${icon('help')}<span class="hide-sm">Обучение</span></button>
        <button class="btn ghost" id="theme-btn" aria-label="Тема">${icon('moon')}</button>
        <button class="btn ghost" id="logout-btn" aria-label="Выйти">${icon('logout')}</button>
      </header>
      ${b.demo ? `<div style="padding:12px max(16px, env(safe-area-inset-right, 0px)) 0 max(20px, env(safe-area-inset-left, 0px))"><div class="demo-band">Демо-режим: компании и люди вымышленные, письма никуда не уходят. Сквозной пример — лид «ТехноСервис Про» (Дмитрий): от вакансии до сделки на 300 000 ₽.<button class="btn sm" id="demo-walk">Пройти пример</button></div></div>` : ''}
      <main class="content" id="view" tabindex="-1"></main>
    </div>
  </div>`;
  $('#menu-btn').addEventListener('click', () => $('#rail').classList.toggle('open'));
  $('#rail').addEventListener('click', (e) => { if (e.target.closest('a')) $('#rail').classList.remove('open'); });
  $('#theme-btn').addEventListener('click', toggleTheme);
  $('#tour-btn').addEventListener('click', () => startTour());
  $('#logout-btn').addEventListener('click', async () => { await act(() => S.api.auth.logout()); S.boot = null; renderAuth(); });
  $('#ws-switch').addEventListener('change', async (e) => { await act(() => S.api.auth.switch(e.target.value)); await refreshBoot(); renderShell(); toast('Кабинет переключён'); });
  $('#demo-walk')?.addEventListener('click', () => startTour('example'));
  window.onhashchange = route;
  route();
  updateCounts();
  if (!b.settings.onboardingDone && b.role !== 'observer') setTimeout(() => startTour(), 600);
  else if (!b.settings.launchDone && b.role === 'owner' && !b.demo && !location.hash) location.hash = '#launch';
}

export async function updateCounts() {
  try {
    const c = await call('GET', '/counts');
    $$('[data-count]').forEach(el => { el.textContent = c[el.dataset.count] || ''; });
    const cr = $('#credit-count'); if (cr) { S.boot.ws.credits = c.credits; cr.textContent = c.credits; }
  } catch { /* счётчики не критичны */ }
}

async function route() {
  const h = location.hash.replace(/^#/, '') || 'dashboard';
  let view = h, param = '';
  const m = h.match(/^(lead|script)-(.+)$/);
  if (m) { view = m[1]; param = idFromHash(m[2]); }
  if (!VIEWS[view]) view = 'dashboard';
  if (S.boot.role === 'observer' && !OBSERVER_VIEWS.includes(view)) view = 'investors';
  S.view = view; S.param = param;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === view || (view === 'lead' && a.dataset.nav === 'leads') || (view === 'script' && a.dataset.nav === 'meetings')));
  // Каждый рендер получает новый узел: обработчики событий прошлых экранов не накапливаются.
  const fresh = () => { const old = $('#view'); const el = old.cloneNode(false); old.replaceWith(el); return el; };
  const render = async () => {
    const el = fresh();
    if (S.view !== view) return;
    el.innerHTML = '<div class="mute">Загрузка…</div>';
    try { await VIEWS[view](el, param); }
    catch (e) { el.innerHTML = `<div class="card"><h3>Не получилось открыть раздел</h3><p class="mute">${esc(e.message)}</p><div><a class="btn" href="">Обновить</a></div></div>`; }
    updateCounts();
  };
  S.render = render;
  await render();
  if (!m) window.scrollTo(0, 0);
}

export { go };
