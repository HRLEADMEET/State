// Обучение: 22 подсказки по элементам управления + сквозной пример тестовой воронки.
import { S, call, leadHash, scriptHash } from './state.js';
import { esc } from './ui.js';

const MAIN = [
  { sel: 'rail', hash: '#dashboard', t: 'Меню разделов', d: 'Слева — весь путь клиента: поиск лидов → лиды → встречи → звонки → сделки. Цифры рядом — сколько в работе.' },
  { sel: 'kpis', hash: '#dashboard', t: 'Деньги и конверсии', d: 'Выручка и открытые сделки — в рублях и в долларах. Ниже — конверсии лид → встреча и встреча → сделка.' },
  { sel: 'todo', hash: '#dashboard', t: 'Следующие действия', d: 'Система сама решает, что важнее сейчас: исследовать нового лида, написать, назначить встречу, открыть скрипт или дожать.' },
  { sel: 'funnel', hash: '#dashboard', t: 'Воронка', d: 'Где теряются люди. Справа — конверсия из предыдущего этапа.' },
  { sel: 'autopilot', hash: '#dashboard', t: 'Автопилот', d: 'Утром сам находит вакансии, исследует компании и готовит касания; вечером закрывает молчащих и присылает итог в Telegram. Можно запустить вручную.' },
  { sel: 'find-signals', hash: '#dashboard', t: 'Начать с поиска лидов', d: 'Главная кнопка: найти компании, где собственник прямо сейчас ищет руководителя продаж.' },
  { sel: 'q-card', hash: '#queue', t: 'Конвейер', d: 'Работа с телефона: одно касание на экране. «Скопировать и открыть» — текст в буфере, чат открыт, вы жмёте «Отправить» и «Да, отправлено». Капчу hh.ru решаете вы.' },
  { sel: 'q-caps', hash: '#queue', t: 'Лимиты в день', d: 'Сколько касаний осталось в каждом канале. Лимиты защищают аккаунты от блокировки — главная ошибка, на которой улетел аккаунт hh.' },
  { sel: 'hh-form', hash: '#signals', t: 'Поиск по hh.ru', d: 'Должности, которые нанимает первое лицо, регион и порог зарплаты. Система оценит каждую вакансию от 0 до 100 и отсеет конкурентов, стоп-ниши и линейные роли.' },
  { sel: 'crm', hash: '#signals', t: 'CRM-файл агента', d: 'Загрузите таблицу, которую ведёт ваш агент на hh: статусы станут этапами, скоринг — оценкой. Выгрузка — обратно в тот же формат.' },
  { sel: 'stage-strip', hash: '#leads', t: 'Этапы лидов', d: 'Нажмите на этап, чтобы отфильтровать. Цвет точки показывает глубину в воронке.' },
  { sel: 'research', hash: 'lead', t: 'Исследовать', d: 'Система читает сайт компании и публичный Telegram-канал собственника: факты, контакты, соцсети и стиль его постов. Списывает 1 кредит.' },
  { sel: 'facts', hash: 'lead', t: 'Что я уже знаю', d: 'Факты с источниками. Письмо строится только на них — генератор ничего не выдумывает. На встрече вы удивите собственника именно ими.' },
  { sel: 'style', hash: 'lead', t: 'Стиль собственника', d: 'На «ты» или на «вы», длина фраз, эмодзи, любимые слова. Письмо зеркалит его манеру, и это звучит по-человечески.' },
  { sel: 'composer', hash: 'lead', t: 'Заход и канал', d: 'Шесть заходов: вакансия, факты и «задайте любой вопрос», цена бездействия, «вас нашла система», кейс, пост. Каналы: почта, Telegram, WhatsApp, Zalo, чат hh.ru.' },
  { sel: 'draft', hash: 'lead', t: 'Черновик', d: 'Нажмите — получите письмо. С подключённым Claude текст станет ещё точнее под человека.' },
  { sel: 'playbook', hash: 'lead', t: 'HH-переписка', d: 'Честный отклик, шаги переписки как кандидат (без слов, за которые банят), перевод в Telegram, слоты по Москве и вашему времени, дожим после встречи.' },
  { sel: 'reply', hash: 'lead', t: 'Ответ собственника', d: 'Вставьте ответ: система поймёт, готов ли он к встрече, и предложит, что ответить. Просьба «не писать» блокирует касания.' },
  { sel: 'meeting', hash: 'lead', t: 'Встреча и сделка', d: 'Назначьте встречу, загрузите запись и оформите сделку из ваших офферов с рассрочкой.' },
  { sel: 'open-script', hash: 'lead', t: 'Скрипт встречи', d: 'Персональный сценарий продающего интервью: рамка, факты, вопросы SPIN, расчёт в деньгах, возражения и закрытие.' },
  { sel: 'meetings-list', hash: '#meetings', t: 'Встречи', d: 'Перед звонком — скрипт, после — запись на разбор.' },
  { sel: 'calls-learn', hash: '#calls', t: 'Разбор звонков', d: 'Доля речи, число вопросов, пройденные этапы и возражения. Сводка показывает, что улучшить в скрипте.' },
  { sel: 'new-exp', hash: '#experiments', t: 'A/B заходов', d: 'Сравнивайте заходы и офферы. Победитель определяется статистически, следующий лид получает лучший вариант.' },
  { sel: 'fc-form', hash: '#forecast', t: 'Что даст 100', d: 'Сколько встреч и денег принесут 100 откликов или 100 целевых собственников. Каждое число помечено: факт, норматив или допущение. Текст для клиента — одной кнопкой.' },
  { sel: 'src-pick', hash: '#sources', t: 'Где искать клиентов', d: 'Не только hh.ru: Работа России, hh.kz, SuperJob, 2ГИС, Яндекс и Google Карты, реестры, чаты. Выберите нишу и рынок — система подскажет, откуда начать, и сама поищет там, где есть API.' },
  { sel: 'hv-signals', hash: '#harvey', t: 'Харви: почта', d: 'Отдельный режим только письмами: подтвердите сигналы, система соберёт когорту и подготовит по 2 коротких письма. Вы одобряете — письма уходят в рабочее время получателя.' },
  { sel: 'fx', hash: '#hypotheses', t: 'Гипотезы и рынки', d: 'HH-партизан против Харви и рекламы: ответы, встречи, сделки по каждому подходу. Ниже — ваши цены в тенге, донгах, юанях, дирхамах.' },
  { sel: 'hire', hash: '#dashboard', t: 'Нанять людей и стать агентом', d: 'Внизу пульта: заявка «нанять продажника / РОПа / заменить РОПа» и личная ссылка агента с процентом от оплат.' },
  { sel: 'model', hash: '#analytics', t: 'Модель денег', d: 'Сколько лидов нужно на сделку, CAC, ROI и прибыль. Кнопка подставляет ваши реальные конверсии.' },
  { sel: 'ch-hh', hash: '#channels', t: 'Каналы', d: 'Конструктор подключений: hh.ru, почта, Telegram, WhatsApp, реклама, любой сайт, записи звонков, Claude.' },
  { sel: 'launch-steps', hash: '#launch', t: 'Мастер запуска', d: 'Пять шагов: оффер, кейсы, кого ищем, как вы пишете, подключения. Каждый клиент проходит его в своём кабинете и вводит свой оффер.' },
  { sel: 'pack-hh', hash: '#pack', t: 'Упаковка профиля', d: 'Резюме hh.ru как лид-магнит и профиль Telegram — из ваших кейсов. Собственник видит цифры и зовёт сам.' },
  { sel: 'new-ws', hash: '#cabinets', t: 'Кабинеты клиентов', d: 'Продали систему — создайте клиенту кабинет и скопируйте в него свою модель. Абонентка + кредиты.' },
  { sel: 'credits', hash: '#cabinets', t: 'Кредиты', d: 'Баланс кредитов: исследование, письмо, разбор звонка. Пополняется пакетами.' },
  { sel: 'tour-btn', hash: '#dashboard', t: 'Обучение всегда под рукой', d: 'Эта кнопка запускает подсказки заново. Значки «?» рядом с полями объясняют каждую настройку.' },
];

const EXAMPLE = [
  { sel: 'profile', hash: 'dmitry', t: 'Шаг 1. Новый лид', d: 'Вакансия «Коммерческий директор» висит 34 дня, «подчинение собственнику». Оценка высокая — отбор ведёт сам Дмитрий.' },
  { sel: 'facts', hash: 'dmitry', t: 'Шаг 2. Исследование', d: 'Сайт и канал собственника дали 15 фактов: с 2014 года, 300+ клиентов, 4 филиала и пост «продажи держатся на мне».' },
  { sel: 'style', hash: 'dmitry', t: 'Шаг 3. Его стиль', d: 'Короткие фразы, живо, иногда эмодзи — письмо написано так же.' },
  { sel: 'composer', hash: 'dmitry', t: 'Шаг 4. Первое касание', d: 'Заход «Факты + задайте любой вопрос» из A/B-эксперимента, вариант B. Ниже в истории — само письмо.' },
  { sel: 'reply', hash: 'dmitry', t: 'Шаг 5. Ответ', d: '«Да, актуально, давайте в четверг в 11:00» — система распознала готовность и назначила встречу.' },
  { sel: 'script-stages', hash: 'dmitry-script', t: 'Шаг 6. Скрипт встречи', d: 'Персональный сценарий с его фактами, расчётом недобора и закрывающим вопросом.' },
  { sel: 'calls-learn', hash: '#calls', t: 'Шаг 7. Разбор звонка', d: 'Оценка 85: все этапы пройдены, но доля речи 72% — в следующий раз дать собственнику говорить больше.' },
  { sel: 'meeting', hash: 'dmitry', t: 'Шаг 8. Сделка', d: 'Консалтинг 50 000 ₽ + настройка 250 000 ₽ двумя платежами. Итого 300 000 ₽ ($3 261). В истории ниже — сделка.' },
  { sel: 'roi', hash: '#analytics', t: 'Шаг 9. Аналитика', d: 'Сделка попала в выручку и в окупаемость канала hh.ru. Дальше — масштабировать победивший заход на новые ниши.' },
];

let state = null;

// Ручной переход в другой раздел во время обучения закрывает подсказки, чтобы они не висели на чужом экране.
window.addEventListener('hashchange', () => {
  if (!state) return;
  if (state.navigating) { state.navigating = false; return; }
  endTour();
});

export async function startTour(kind = 'main') {
  endTour();
  const steps = kind === 'example' ? EXAMPLE : MAIN;
  let leadId = null, dmitryId = null;
  try {
    const leads = await call('GET', '/leads');
    dmitryId = leads.find(l => l.company === 'ТехноСервис Про')?.id || null;
    leadId = dmitryId || leads.find(l => !l.demo)?.id || leads[0]?.id || null;
  } catch { /* без лидов шаги карточки пропускаются */ }
  if (kind === 'example' && !dmitryId) return alertNoExample();
  state = { steps, i: 0, leadId, dmitryId, kind };
  show();
}

function alertNoExample() {
  import('./ui.js').then(({ toast }) => toast('Пример доступен в демо-кабинете (лид «ТехноСервис Про»).', 'bad'));
}

function resolveHash(h) {
  if (h === 'lead') return state.leadId ? leadHash(state.leadId) : null;
  if (h === 'dmitry') return state.dmitryId ? leadHash(state.dmitryId) : null;
  if (h === 'dmitry-script') return state.dmitryId ? scriptHash(state.dmitryId) : null;
  return h;
}

async function waitFor(sel, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const el = document.querySelector(`[data-tour="${sel}"]`); if (el && el.offsetParent !== null) return el; await new Promise(r => setTimeout(r, 80)); }
  return null;
}

async function show() {
  if (!state) return;
  const st = state.steps[state.i];
  const hash = resolveHash(st.hash);
  if (hash === null) return next(1);
  if (hash && location.hash !== hash) { state.navigating = true; location.hash = hash; }
  if (window.innerWidth <= 860 && st.sel === 'rail') document.getElementById('rail')?.classList.add('open');
  const target = await waitFor(st.sel);
  if (!state) return;
  if (!target) return next(1);
  target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  await new Promise(r => setTimeout(r, 250));
  draw(target, st);
}

function draw(target, st) {
  removeLayer();
  const r = target.getBoundingClientRect();
  const ring = document.createElement('div'); ring.className = 'tour-ring';
  Object.assign(ring.style, { left: (r.left + scrollX - 6) + 'px', top: (r.top + scrollY - 6) + 'px', width: (r.width + 12) + 'px', height: Math.min(r.height + 12, innerHeight * 0.8) + 'px' });
  const card = document.createElement('div'); card.className = 'tour-card'; card.setAttribute('role', 'dialog');
  const n = state.steps.length;
  card.innerHTML = `<span class="step">${state.kind === 'example' ? 'Пример воронки' : 'Обучение'} · ${state.i + 1} из ${n}</span><h3>${esc(st.t)}</h3><p class="small">${esc(st.d)}</p>
    <div class="row between"><button class="btn sm ghost" data-t="end">Закончить</button><div class="row"><button class="btn sm" data-t="prev" ${state.i ? '' : 'disabled'}>Назад</button><button class="btn sm primary" data-t="next">${state.i === n - 1 ? 'Готово' : 'Дальше'}</button></div></div>`;
  document.body.append(ring, card);
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const vw = document.documentElement.clientWidth;
  let top = r.bottom + scrollY + 14;
  if (r.bottom + ch + 24 > innerHeight) top = Math.max(scrollY + 16, r.top + scrollY - ch - 14);
  if (r.height > innerHeight * 0.6) top = scrollY + innerHeight - ch - 16;
  card.style.top = top + 'px';
  card.style.left = Math.max(16, Math.min(r.left + scrollX, scrollX + vw - cw - 16)) + 'px';
  card.querySelector('[data-t="next"]').focus();
  card.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'end') endTour(true); else next(b.dataset.t === 'next' ? 1 : -1); });
  state.onKey = (e) => { if (e.key === 'Escape') endTour(true); if (e.key === 'ArrowRight') next(1); if (e.key === 'ArrowLeft') next(-1); };
  document.addEventListener('keydown', state.onKey);
}

function next(d) {
  if (!state) return;
  if (state.onKey) document.removeEventListener('keydown', state.onKey);
  state.i += d;
  if (state.i < 0) state.i = 0;
  if (state.i >= state.steps.length) return endTour(true);
  document.getElementById('rail')?.classList.remove('open');
  show();
}

function removeLayer() { document.querySelectorAll('.tour-ring, .tour-card').forEach(e => e.remove()); }

export function endTour(finished = false) {
  if (state?.onKey) document.removeEventListener('keydown', state.onKey);
  const wasMain = state?.kind === 'main';
  state = null; removeLayer();
  document.getElementById('rail')?.classList.remove('open');
  if (finished && wasMain && S.boot && !S.boot.settings.onboardingDone && S.boot.role === 'owner') {
    S.boot.settings.onboardingDone = true;
    call('PUT', '/settings', { onboardingDone: true }).catch(() => {});
  }
}

export const TOUR_STEPS = MAIN.length;
