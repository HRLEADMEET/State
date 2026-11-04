// Справочники: офферы LEADMEET, тарифы платформы, каналы трафика, роли, доказательства.
// Цифры кейсов взяты из публичных страниц HRLEADMEET/calculator и HRLEADMEET/audit.

export const BRAND = {
  name: 'LEADMEET',
  person: 'Влад Лев',
  title: 'архитектор систем продаж, 10+ лет в найме и продажах',
  telegram: '@vladlev007',
  channel: 'https://t.me/hrleadmeet',
  reviews: 'https://t.me/VLADLEVOTZIV',
  // URL опубликованных страниц из репозиториев audit и calculator — заполняются в Настройках.
  auditPage: '',
  calculatorPage: '',
};

/** Проверяемые факты из твоих кейсов — генератор берёт доказательства только отсюда (без выдумок). */
export const PROOFS = [
  { id: 'funnel', isCase: true, short: '29 360 откликов → 11 менеджеров на плане', text: 'на проекте по банкротству физлиц из 29 360 откликов с hh.ru до выполнения плана дошли 11 менеджеров — и мы видим каждый этап воронки', niche: ['sales', 'bfl', 'hiring'], url: 'https://t.me/hrleadmeet' },
  { id: 'cpm', isCase: true, short: '13 928 ₽ за менеджера на плане', text: 'менеджер, доведённый до выполнения плана, обошёлся в 13 928 ₽ при рекламе вакансий 167 140 ₽ за период', niche: ['sales', 'hiring'], url: 'https://t.me/hrleadmeet' },
  { id: 'bfl', isCase: true, short: 'БФЛ: 3 месяца с нуля, 7,67 млн ₽', text: 'в банкротстве физлиц за 3 месяца с нуля: 1 689 лидов, 387 встреч, 84 договора и 7,67 млн ₽ выручки', niche: ['bfl', 'legal', 'sales'], url: 'https://t.me/hrleadmeet/62' },
  { id: '100days', isCase: true, short: 'Отдел продаж за 100 дней, в 5 раз дешевле рынка', text: 'отдел продаж с нуля за 100 дней без агентств — в пять раз дешевле рынка, конверсия 2,96%', niche: ['sales', 'it', 'services'], url: 'https://t.me/hrleadmeet/87' },
  { id: '998', isCase: true, short: '998 кандидатов за сутки', text: 'запуск автонайма дал 998 кандидатов за одни сутки', niche: ['hiring'], url: 'https://t.me/vladlev1/4339' },
  { id: '5in2', isCase: true, short: '5 менеджеров за 2 недели', text: '5 менеджеров за 2 недели: просмотры вакансии выросли в 11 раз, отклики — втрое', niche: ['hiring', 'sales'], url: 'https://t.me/vladlev1/3946' },
  { id: '200', short: 'Отдел на 200+ менеджеров', text: 'я сам строил и вёл отдел продаж на 200+ менеджеров', niche: ['sales'], url: 'https://t.me/hrleadmeet' },
  { id: 'partizan', isCase: true, short: '3 сделки на 1,5+ млн ₽ за месяц через hh.ru', text: 'за месяц через hh.ru закрыл 3 сделки на 1,5+ млн ₽ — собственники сами звали на встречу', niche: ['sales', 'it', 'services', 'all'], url: 'https://t.me/vladlev1' },
  { id: 'close28', isCase: true, short: 'Встреча → продажа: 14% → 28%', text: 'после разбора записей 10 встреч конверсия встреча → продажа выросла с 14% до 28% за 2 недели', niche: ['sales', 'all'], url: 'https://t.me/vladlev1' },
  { id: 'reviews', short: '500+ отзывов', text: 'в открытом канале больше 500 отзывов сотрудников и заказчиков', niche: ['all'], url: 'https://t.me/VLADLEVOTZIV' },
];

/** Твоя продуктовая линейка (из калькулятора) + консалтинг и настройка, как в кейсе с Дмитрием. */
export const DEFAULT_OFFERS = [
  { id: 'audit', name: 'Бесплатный аудит воронки (30–40 мин)', priceRub: 0, kind: 'lead_magnet', desc: 'Разбор воронки по цифрам, диагноз и план действий. Вход в воронку.' },
  { id: 'start', name: 'START: скрипты, CRM, KPI, аудит', priceRub: 75000, kind: 'service', desc: 'Скрипты, CRM, KPI и аудит за 7 дней (50 000 – 100 000 ₽).' },
  { id: 'consult', name: 'Консалтинг: стратсессия + план', priceRub: 50000, kind: 'consulting', desc: 'Диагностика бизнеса собственника, карта узких мест, план на 90 дней.' },
  { id: 'hire', name: 'НАЙМ МОП: найм + адаптация + вывод на план', priceRub: 185000, kind: 'service', desc: 'Найм, адаптация и вывод менеджера на план за 7–14 дней (120 000 – 250 000 ₽).' },
  { id: 'roi', name: 'ROI-PARTNER: 15% выручки', priceRub: 0, kind: 'partner', desc: 'Под ключ с ведением, без входного платежа, от 3 месяцев — 15% выручки отдела.' },
  { id: 'setup', name: 'Настройка системы привлечения/продаж', priceRub: 250000, kind: 'setup', desc: 'Внедрение системы: воронка, скрипты, найм, контроль. Как в кейсе «Дмитрий».' },
  { id: 'l1', name: 'Уровень 1 · Найм', priceRub: 99900, kind: 'service', desc: 'Упаковка вакансии, воронка откликов, отбор, выход менеджера.' },
  { id: 'l2', name: 'Уровень 2 · Система найма', priceRub: 209900, kind: 'service', desc: 'Поток 100+ откликов, KPI, адаптация, 2–3 менеджера в штате (189 900 – 229 900 ₽).' },
  { id: 'l3', name: 'Уровень 3 · Отдел под ключ', priceRub: 499900, kind: 'service', desc: '5 менеджеров, обучение, скрипты, регламенты, книга продаж, замена 30 дней.' },
  { id: 'l4', name: 'Уровень 4 · Система', priceRub: 1299000, kind: 'service', desc: 'HR-система остаётся у вас, РОП на 2 месяца, передача системы.' },
  { id: 'airop', name: 'AI-РОП: контроль звонков', priceRub: 36000, kind: 'subscription', desc: 'ИИ разбирает 100% звонков. От 36 000 ₽/мес.' },
  { id: 'platform', name: 'Платформа LEADMEET OS «как у меня»', priceRub: 39900, kind: 'subscription', desc: 'Та же система, которая нашла клиента: каналы, письма, скрипты, аналитика. Абонентка + кредиты.' },
];

/** Тарифы SaaS: абонентка + кредиты. 1 кредит = 1 исследование компании + персональное сообщение. */
export const PLANS = [
  { id: 'start', name: 'Старт', priceRub: 14900, credits: 300, seats: 1, workspaces: 1, features: ['HH-сигналы', 'Письма в стиле собственника', 'Скрипты встреч', 'Аналитика воронки'] },
  { id: 'pro', name: 'Про', priceRub: 39900, credits: 1200, seats: 3, workspaces: 3, features: ['Всё из Старт', 'A/B офферов с автовыбором', 'Разбор звонков', 'Telegram/WhatsApp', 'Свои каналы трафика'] },
  { id: 'agency', name: 'Агентство', priceRub: 99000, credits: 4000, seats: 10, workspaces: 25, features: ['Всё из Про', 'Кабинеты клиентов', 'White-label', 'Роль наблюдателя для инвесторов', 'Приоритетная поддержка'] },
];
export const CREDIT_PACKS = [
  { id: 'c500', credits: 500, priceRub: 7900 },
  { id: 'c2000', credits: 2000, priceRub: 24900 },
  { id: 'c10000', credits: 10000, priceRub: 99000 },
];
/** Сколько кредитов стоит действие (себестоимость ИИ + данные + маржа). */
export const CREDIT_COST = { research: 1, message: 1, llm_message: 2, call_analysis: 5, transcribe_min: 1 };

/** Каналы: адаптеры входа лидов и исходящих касаний. mode: 'api' — реальная интеграция; 'webhook' — приём; 'manual' — живое касание с подготовленным текстом. */
export const CHANNELS = [
  { type: 'hh', name: 'HeadHunter (вакансии и отклики)', dir: 'both', mode: 'api', fields: [{ k: 'userAgent', label: 'HH-User-Agent (название приложения и email)', secret: false }, { k: 'token', label: 'OAuth-токен приложения (поиск, необязательно)', secret: true }, { k: 'applicantToken', label: 'OAuth-токен соискателя (для откликов и переписки)', secret: true }, { k: 'resumeId', label: 'ID резюме для откликов' }], doc: 'Официальный API api.hh.ru: поиск вакансий, карточки работодателей, отклики и переписка соискателя. Капчу hh.ru решаете вы — приложение даёт ссылку.' },
  { type: 'dadata', name: 'ЕГРЮЛ (DaData): руководитель компании', dir: 'none', mode: 'api', fields: [{ k: 'apiKey', label: 'API-ключ DaData', secret: true }], doc: 'Официальные данные ФНС: руководитель, дата регистрации, численность. Помогает найти собственника, если на сайте его нет.' },
  { type: 'email', name: 'Почта (SMTP)', dir: 'out', mode: 'api', fields: [{ k: 'host', label: 'SMTP-сервер' }, { k: 'port', label: 'Порт (465/587)' }, { k: 'user', label: 'Логин' }, { k: 'pass', label: 'Пароль приложения', secret: true }, { k: 'from', label: 'От кого (Влад Лев <vlad@...>)' }, { k: 'dailyCap', label: 'Лимит писем в день (рекомендуется ≤ 40)' }], doc: 'Свой ящик на своём домене с SPF/DKIM/DMARC. Прогрев, лимиты, отписка.' },
  { type: 'telegram_bot', name: 'Telegram-бот (уведомления и заявки)', dir: 'both', mode: 'api', fields: [{ k: 'botToken', label: 'Токен бота от @BotFather', secret: true }, { k: 'chatId', label: 'Ваш chat_id для уведомлений' }], doc: 'Уведомления о новых лидах и ответах, приём заявок.' },
  { type: 'telegram_personal', name: 'Telegram (рабочий профиль)', dir: 'out', mode: 'manual', fields: [{ k: 'username', label: 'Ваш @username' }], doc: 'Живые сообщения с вашего профиля: приложение готовит текст и открывает чат одной кнопкой. Без юзерботов — без банов.' },
  { type: 'whatsapp', name: 'WhatsApp', dir: 'out', mode: 'manual', fields: [{ k: 'phone', label: 'Рабочий номер' }], doc: 'Ссылка wa.me с готовым текстом. Для массовых — официальный WhatsApp Business API.' },
  { type: 'zalo', name: 'Zalo', dir: 'out', mode: 'manual', fields: [{ k: 'phone', label: 'Номер' }], doc: 'Ссылка zalo.me на контакт; текст копируется в буфер.' },
  { type: 'hh_chat', name: 'Чат hh.ru (отклик/переписка)', dir: 'out', mode: 'manual', fields: [], doc: 'Готовый текст для переписки по вакансии на hh.ru.' },
  { type: 'vk', name: 'ВКонтакте (группы и сообщения)', dir: 'both', mode: 'webhook', fields: [{ k: 'token', label: 'Ключ сообщества', secret: true }, { k: 'confirm', label: 'Строка подтверждения Callback API' }], doc: 'Callback API сообщества: заявки из сообщений и лид-форм.' },
  { type: 'yandex_direct', name: 'Яндекс Директ', dir: 'in', mode: 'webhook', fields: [{ k: 'token', label: 'OAuth-токен Директа (для расходов)', secret: true }, { k: 'login', label: 'Логин клиента' }], doc: 'Лиды — через вебхук формы/лендинга с utm; расходы — через API отчётов.' },
  { type: 'google_ads', name: 'Google Ads', dir: 'in', mode: 'webhook', fields: [{ k: 'key', label: 'Webhook key лид-форм', secret: true }], doc: 'Lead Form Extensions → вебхук.' },
  { type: 'tiktok', name: 'TikTok Ads', dir: 'in', mode: 'webhook', fields: [{ k: 'token', label: 'Access token', secret: true }], doc: 'Instant Form → вебхук / Zapier.' },
  { type: 'instagram', name: 'Instagram / Facebook Lead Ads', dir: 'in', mode: 'webhook', fields: [{ k: 'verify', label: 'Verify token', secret: true }], doc: 'Meta Lead Ads → вебхук.' },
  { type: 'tg_chats', name: 'Чаты руководителей (Telegram/VK)', dir: 'in', mode: 'manual', fields: [{ k: 'list', label: 'Список чатов (по строке)' }], doc: 'Источник: чаты собственников, коучей, психологов, стоматологов, IT. Ручная работа с сигналами.' },
  { type: 'site_form', name: 'Любой сайт (виджет-форма)', dir: 'in', mode: 'webhook', fields: [], doc: 'Вставьте сниппет — заявки с любого сайта падают в систему с utm.' },
  { type: 'recorder', name: 'Записи звонков (mymeet.ai, Zoom, Телемост, МТС Линк, диктофон)', dir: 'in', mode: 'webhook', fields: [{ k: 'provider', label: 'Сервис: mymeet / openai / deepgram' }, { k: 'key', label: 'API-ключ сервиса', secret: true }], doc: 'mymeet.ai: бот записывает встречу по ссылке, расшифровка уходит на разбор. Также — загрузка аудио или текста и вебхук готовой расшифровки.' },
  { type: 'superjob', name: 'SuperJob (вакансии)', dir: 'in', mode: 'api', fields: [{ k: 'apiKey', label: 'Secret key приложения api.superjob.ru', secret: true }], doc: 'Ещё одна площадка вакансий для HH-партизана. Ключ бесплатный: api.superjob.ru → «Зарегистрировать приложение».' },
  { type: 'twogis', name: '2ГИС (компании в городе)', dir: 'in', mode: 'api', fields: [{ k: 'apiKey', label: 'Ключ API 2ГИС (Places API)', secret: true }], doc: 'Компании ниши: сайт, телефон, рейтинг, филиалы — источник для «Харви: почта».' },
  { type: 'yandex_maps', name: 'Яндекс Карты (поиск организаций)', dir: 'in', mode: 'api', fields: [{ k: 'apiKey', label: 'Ключ «API поиска по организациям»', secret: true }], doc: 'developer.tech.yandex.ru → API поиска по организациям (платный тариф для коммерческого использования).' },
  { type: 'google_places', name: 'Google Maps (Places API)', dir: 'in', mode: 'api', fields: [{ k: 'apiKey', label: 'API key Google Cloud (Places API New)', secret: true }], doc: 'Международные рынки: Вьетнам, ОАЭ, Турция, Европа. ~$0,03 за запрос.' },
  { type: 'metrika', name: 'Яндекс Метрика', dir: 'in', mode: 'api', fields: [{ k: 'counterId', label: 'Номер счётчика' }, { k: 'token', label: 'OAuth-токен (доступ к статистике)', secret: true }], doc: 'Визиты и цели по utm_source за 30 дней — для сравнения рекламных гипотез (HH-партизан, Харви, реклама).' },
  { type: 'stats2', name: 'Второй счётчик (Google Analytics 4 / Roistat)', dir: 'in', mode: 'manual', fields: [{ k: 'id', label: 'ID потока GA4 или проекта Roistat' }], doc: 'Сверка данных Метрики. Код счётчика ставится на лендинг; цифры сверяйте в отчёте сервиса.' },
  { type: 'llm', name: 'ИИ (Claude)', dir: 'none', mode: 'api', fields: [{ k: 'apiKey', label: 'ANTHROPIC_API_KEY', secret: true }], doc: 'Глубокая персонализация писем и разбор звонков. Без ключа работает шаблонный движок.' },
];

/** Роли HH, которые собственник малого/среднего бизнеса обычно нанимает лично. */
export const OWNER_HIRED_ROLES = [
  'коммерческий директор', 'директор по продажам', 'руководитель отдела продаж', 'роп', 'head of sales',
  'исполнительный директор', 'операционный директор', 'coo', 'директор по маркетингу', 'cmo', 'маркетолог',
  'бизнес-ассистент', 'помощник руководителя', 'ассистент собственника', 'заместитель генерального директора',
  'директор по развитию', 'руководитель направления', 'управляющий', 'генеральный директор', 'cto', 'технический директор',
];

/** Ниши для масштабирования гипотез. */
export const NICHES = [
  { id: 'it', name: 'IT / разработка / SaaS', avgCheckRub: 300000, note: 'Перспективная: длинный цикл, высокий чек, собственники пишут посты.' },
  { id: 'bfl', name: 'Банкротство физлиц', avgCheckRub: 250000, note: 'Отработанная ниша, есть кейс на 7,67 млн ₽.' },
  { id: 'services', name: 'Услуги B2B (агентства, консалтинг)', avgCheckRub: 250000 },
  { id: 'dental', name: 'Стоматологии и клиники', avgCheckRub: 300000 },
  { id: 'coach', name: 'Коучи, психологи, эксперты', avgCheckRub: 200000 },
  { id: 'infobiz', name: 'Инфобизнес / онлайн-школы', avgCheckRub: 300000 },
  { id: 'design', name: 'Дизайн, маркетинг, продакшн', avgCheckRub: 200000 },
  { id: 'realty', name: 'Недвижимость, стройка', avgCheckRub: 350000 },
  { id: 'other', name: 'Другое', avgCheckRub: 200000 },
];

export const STAGES = [
  { id: 'new', name: 'Новый сигнал' },
  { id: 'researched', name: 'Исследован' },
  { id: 'contacted', name: 'Написали' },
  { id: 'replied', name: 'Ответил' },
  { id: 'meeting', name: 'Встреча' },
  { id: 'won', name: 'Сделка' },
  { id: 'lost', name: 'Отказ' },
];

export const ROLES = {
  owner: { name: 'Владелец', can: ['*'] },
  manager: { name: 'Менеджер', can: ['leads', 'messages', 'meetings', 'calls', 'deals:read', 'analytics'] },
  client: { name: 'Клиент (кабинет)', can: ['leads', 'messages', 'meetings', 'calls', 'analytics', 'deals:read'] },
  observer: { name: 'Наблюдатель / инвестор', can: ['analytics', 'investors'] },
};

export function can(role, perm) {
  const r = ROLES[role];
  if (!r) return false;
  if (r.can.includes('*') || r.can.includes(perm)) return true;
  const [area, action] = perm.split(':');
  // 'area' даёт чтение и запись; 'area:read' — только чтение.
  return r.can.includes(area) && (!action || action === 'read');
}
