// Демо-данные: вымышленные компании и люди. Совпадения случайны.
// Используются в демо-режиме и в тестах вместо реальных hh.ru / сайтов / Telegram.
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

export const MOCK_VACANCIES = [
  { id: '90000001', name: 'Коммерческий директор', alternate_url: 'https://hh.ru/vacancy/90000001', published_at: daysAgo(34), area: { name: 'Москва' },
    salary: { from: 250000, to: 350000, currency: 'RUR' }, employer: { id: '7000001', name: 'ТехноСервис Про', alternate_url: 'https://hh.ru/employer/7000001' },
    snippet: { requirement: 'Опыт построения отдела продаж с нуля. Работа напрямую с собственником.', responsibility: 'Построить отдел продаж B2B, выполнение плана, найм и обучение менеджеров.' },
    description: '<p>Мы — небольшая компания, сервисное обслуживание промышленного оборудования, на рынке с 2014 года. Ищем коммерческого директора — правую руку собственника.</p><p>Задачи: выстроить отдел продаж из 4 менеджеров, внедрить CRM и скрипты, выполнение плана. Подчинение собственнику.</p>' },
  { id: '90000002', name: 'Руководитель отдела продаж (РОП)', alternate_url: 'https://hh.ru/vacancy/90000002', published_at: daysAgo(22), area: { name: 'Санкт-Петербург' },
    salary: { from: 180000, to: 260000, currency: 'RUR' }, employer: { id: '7000002', name: 'КодЛаб', alternate_url: 'https://hh.ru/employer/7000002' },
    snippet: { requirement: 'Опыт B2B продаж IT-услуг, управление командой от 5 человек.', responsibility: 'Исходящие продажи, найм менеджеров, KPI.' },
    description: '<p>КодЛаб — студия разработки, 40 человек, 120+ проектов. Ищем РОПа, который построит исходящие продажи и наймёт 5 менеджеров. Работа напрямую с основателем.</p>' },
  { id: '90000003', name: 'Директор по развитию сети клиник', alternate_url: 'https://hh.ru/vacancy/90000003', published_at: daysAgo(9), area: { name: 'Казань' },
    salary: { from: 200000, to: 300000, currency: 'RUR' }, employer: { id: '7000003', name: 'Смайл Дент', alternate_url: 'https://hh.ru/employer/7000003' },
    snippet: { requirement: 'Опыт в медицине, маркетинг и продажи.', responsibility: 'Масштабирование сети, рост первичных пациентов, администраторы.' },
    description: '<p>Сеть стоматологий «Смайл Дент», 6 клиник. Задача — масштабировать до 10 клиник, выстроить продажи администраторов и маркетинг. Подчинение собственнику.</p>' },
  { id: '90000004', name: 'Бизнес-ассистент собственника', alternate_url: 'https://hh.ru/vacancy/90000004', published_at: daysAgo(15), area: { name: 'Москва' },
    salary: { from: 120000, to: 160000, currency: 'RUR' }, employer: { id: '7000004', name: 'Онлайн-школа «Ментор»', alternate_url: 'https://hh.ru/employer/7000004' },
    snippet: { requirement: 'Системность, управление проектами.', responsibility: 'Помощь основателю, контроль отдела продаж и запусков.' },
    description: '<p>Онлайн-школа «Ментор», 3000 учеников. Ищем бизнес-ассистента основателя: контроль отдела продаж, регламенты, запуски.</p>' },
  { id: '90000005', name: 'Менеджер по продажам', alternate_url: 'https://hh.ru/vacancy/90000005', published_at: daysAgo(3), area: { name: 'Москва' },
    salary: { from: 60000, to: 90000, currency: 'RUR' }, employer: { id: '7000005', name: 'Кадровое агентство «Персонал Плюс»', alternate_url: 'https://hh.ru/employer/7000005' },
    snippet: { requirement: 'Холодные звонки.', responsibility: 'Продажи.' }, description: '<p>Для нашего клиента ищем менеджера по продажам.</p>' },
  { id: '90000006', name: 'Исполнительный директор', alternate_url: 'https://hh.ru/vacancy/90000006', published_at: daysAgo(41), area: { name: 'Екатеринбург' },
    salary: { from: 300000, to: 400000, currency: 'RUR' }, employer: { id: '7000006', name: 'СтройДом Урал', alternate_url: 'https://hh.ru/employer/7000006' },
    snippet: { requirement: 'Опыт управления в строительстве.', responsibility: 'Операционное управление, продажи, масштабирование.' },
    description: '<p>Строим частные дома, 15 лет на рынке, 400+ объектов. Собственник ищет исполнительного директора: продажи, производство, регламенты. Опцион.</p>' },
];

export const MOCK_EMPLOYERS = {
  7000001: { id: '7000001', name: 'ТехноСервис Про', site_url: 'https://technoservice-pro.example', open_vacancies: 3, industries: [{ name: 'Промышленное оборудование' }], area: { name: 'Москва' }, alternate_url: 'https://hh.ru/employer/7000001' },
  7000002: { id: '7000002', name: 'КодЛаб', site_url: 'https://codelab.example', open_vacancies: 5, industries: [{ name: 'Разработка ПО' }], area: { name: 'Санкт-Петербург' }, alternate_url: 'https://hh.ru/employer/7000002' },
  7000003: { id: '7000003', name: 'Смайл Дент', site_url: 'https://smiledent.example', open_vacancies: 8, industries: [{ name: 'Медицина' }], area: { name: 'Казань' }, alternate_url: 'https://hh.ru/employer/7000003' },
  7000004: { id: '7000004', name: 'Онлайн-школа «Ментор»', site_url: 'https://mentor-school.example', open_vacancies: 2, industries: [{ name: 'Образование' }], area: { name: 'Москва' }, alternate_url: 'https://hh.ru/employer/7000004' },
  7000006: { id: '7000006', name: 'СтройДом Урал', site_url: 'https://stroydom-ural.example', open_vacancies: 4, industries: [{ name: 'Строительство' }], area: { name: 'Екатеринбург' }, alternate_url: 'https://hh.ru/employer/7000006' },
};

export const MOCK_SITES = {
  'https://technoservice-pro.example': `<html><head><title>ТехноСервис Про — сервис промышленного оборудования</title>
    <meta name="description" content="Обслуживаем компрессоры и насосное оборудование для 300 заводов. Выезд инженера за 24 часа."></head>
    <body><h1>Сервис оборудования без простоев</h1><h2>Работаем с 2014 года</h2><p>Более 300 клиентов, 4 филиала по России.</p>
    <p>Контакты: +7 (495) 123-45-67, info@technoservice-pro.example, директор: d.orlov@technoservice-pro.example</p>
    <a href="https://t.me/orlov_business">Канал основателя</a> <a href="https://vk.com/technoservicepro">ВК</a>
    <script src="https://mc.yandex.ru/metrika/tag.js"></script><script src="//code.jivo.ru/widget/abc"></script></body></html>`,
  'https://codelab.example': `<html><head><title>КодЛаб — разработка веб-сервисов</title><meta name="description" content="Разрабатываем SaaS и мобильные приложения. 120+ проектов, 40 разработчиков."></head>
    <body><h1>Делаем продукты, которые продают</h1><p>8 лет на рынке. hello@codelab.example</p><a href="https://t.me/codelab_ceo">CEO-блог</a></body></html>`,
};

export const MOCK_TELEGRAM = {
  orlov_business: `<div class="tgme_channel_info_header_title"><span>Дмитрий Орлов | Сервис и бизнес</span></div>
    <div class="tgme_widget_message_text js-message_text">Друзья, всем привет! Подвёл итоги квартала: выручка +18%, но продажи по-прежнему держатся на мне. Пора это менять 💪</div>
    <div class="tgme_widget_message_text js-message_text">Самая большая ошибка собственника — думать, что сильный продажник решит все проблемы. Решает система. Ищу коммерческого директора уже второй месяц, и это больно.</div>
    <div class="tgme_widget_message_text js-message_text">Если вы собственник и тоже сами закрываете крупные сделки — напишите, как вы выбрались из этой ловушки. Мне правда интересно. Масштаб без системы — это просто больше хаоса.</div>
    <div class="tgme_widget_message_text js-message_text">Цифры недели: 4 новых договора, 2 из них — по рекомендации. Рекомендации — это круто, но это не система 🙂</div>`,
  codelab_ceo: `<div class="tgme_channel_info_header_title"><span>CEO КодЛаб</span></div>
    <div class="tgme_widget_message_text">Мы выросли до 40 человек и я понял одну вещь: разработка масштабируется, а продажи — нет. Пока всё через меня.</div>
    <div class="tgme_widget_message_text">Ищем РОПа. Если ты строил outbound в IT — пиши мне в личку, обсудим.</div>`,
};

/** Расшифровка демо-встречи с Дмитрием: консалтинг 50 000 ₽ + настройка 250 000 ₽. */
export const MOCK_TRANSCRIPT = `Влад: Дмитрий, спасибо, что нашли время. У нас 40 минут. Предлагаю так: я задам несколько вопросов, покажу, что уже вижу по ТехноСервис Про, а в конце честно скажу — могу помочь или нет. Договорились?
Дмитрий: Да, давайте.
Влад: Я подготовился и вот что увидел: вы на рынке с 2014 года, у вас больше 300 клиентов и 4 филиала, коммерческого директора ищете уже 34 дня, а в канале вы писали, что продажи держатся на вас. Что из этого неверно?
Дмитрий: Всё верно. Особенно последнее, это прям боль. Я сам закрываю все крупные сделки и уже не вывожу.
Влад: Сколько заявок в месяц приходит в продажи и сколько менеджеров сейчас?
Дмитрий: Заявок около 120, менеджеров четыре, план стабильно делает один.
Влад: А средний чек и цикл сделки?
Дмитрий: Чек около 400 тысяч, цикл полтора-два месяца.
Влад: На каком этапе от заявки до оплаты вы теряете больше всего?
Дмитрий: После первого звонка. Менеджеры не доводят до встречи, КП висят, никто не дожимает. Нет системы, всё держится на мне.
Влад: Если ничего не менять три месяца, сколько это в выручке, как думаете?
Дмитрий: Ну если хотя бы 10 сделок теряем в месяц, это четыре миллиона. Страшно считать.
Влад: А сколько вашего личного времени в неделю уходит на продажи и найм?
Дмитрий: Часов двадцать, наверное. Больше половины рабочего времени.
Влад: Если бы через 60 дней отдел стабильно делал план без вас, что бы это дало вам лично?
Дмитрий: Я бы занялся новым направлением, мы давно хотим запустить сервисные контракты. И честно, я бы выдохнул.
Влад: Смотрите, что я услышал: заявки есть, менеджеры теряют их после первого звонка, и вы тратите 20 часов в неделю, чтобы это компенсировать. Я предлагаю два шага. Первый — консалтинг: стратсессия и план на 90 дней, стоимость 50 000 рублей. Второй — настройка системы: воронка, скрипты, найм и контроль, 250 000 рублей. По вашим цифрам это окупается за первый месяц, если вернуть хотя бы одну сделку.
Дмитрий: Дорого, если честно. Мы на подрядчиков столько не тратили.
Влад: Согласен, сумма заметная. Давайте сравним не с нулём, а с тем, что уже теряется: вы сами сказали — четыре миллиона в месяц. Одна возвращённая сделка — 400 тысяч. Что из этого расчёта кажется неверным?
Дмитрий: Да нет, всё так. Какие гарантии?
Влад: Плановый показатель фиксируем в договоре. Если менеджер не подошёл — заменяем в течение 30 дней без доплаты. Как удобнее — внести всю сумму сразу без наценки или стартовым платежом с рассрочкой?
Дмитрий: Давайте консалтинг сразу, а настройку двумя платежами.
Влад: Отлично. Фиксирую: сегодня пришлю договор и счёт, установочная встреча в четверг в 11:00. От вас — доступ к CRM. Договорились?
Дмитрий: Договорились.`;

export const MOCK_REPLY_DMITRY = 'Влад, добрый. Да, актуально, прям в точку. Давайте созвонимся в четверг в 11:00?';

export const MOCK_TEAM = {
  'https://technoservice-pro.example': `<h2>Команда</h2><div>Орлов Дмитрий Сергеевич</div><div>Основатель и генеральный директор</div><div>Анна Белова</div><div>Руководитель сервисной службы</div>`,
  'https://codelab.example': `<h2>О нас</h2><p>Алексей Ким — CEO и основатель студии</p>`,
};

/** Демо-организации с карт (вымышленные): для режима «Харви: почта». */
export const MOCK_ORGS = [
  { id: 'org-1', name: 'Клиника «Белый клык»', city: 'Москва', address: 'Москва, ул. Примерная, 12', site: 'https://belyklyk.example', email: 'owner@belyklyk.example', phone: '+7 495 000-00-01', rating: 4.3, reviews: 214, branches: 3 },
  { id: 'org-2', name: 'Агентство недвижимости «Квадрат»', city: 'Казань', address: 'Казань, пр. Демо, 5', site: 'https://kvadrat-realty.example', email: 'info@kvadrat-realty.example', phone: '+7 843 000-00-02', rating: 4.8, reviews: 96, branches: 2 },
  { id: 'org-3', name: 'Школа английского «Спикап»', city: 'Москва', address: 'Москва, Тестовый пер., 3', site: 'https://speakup-school.example', email: 'hello@speakup-school.example', phone: '+7 495 000-00-03', rating: 4.9, reviews: 51, branches: 1 },
  { id: 'org-4', name: 'Saigon Dental Care', city: 'Хошимин', address: 'Ho Chi Minh City, District 1, Demo st. 7', site: 'https://saigondental.example', email: 'contact@saigondental.example', phone: '+84 28 0000 0004', rating: 4.4, reviews: 330, branches: 4 },
  { id: 'org-5', name: 'Desert Fitness Club', city: 'Дубай', address: 'Dubai, Demo Tower', site: 'https://desertfit.example', email: 'manager@desertfit.example', phone: '+971 4 000 0005', rating: 4.6, reviews: 120, branches: 2 },
  { id: 'org-6', name: 'Ремонт «Без пыли»', city: 'Москва', address: 'Москва, ул. Демо, 1', site: '', email: 'zakaz@bezpyli.nomail.example', phone: '+7 495 000-00-06', rating: 4.1, reviews: 40, branches: 1 },
];

/** Демо-вакансии с других площадок (Работа России, hh.kz, SuperJob). */
export const MOCK_SOURCE_VACANCIES = [
  { id: 'tv-501', name: 'Руководитель отдела продаж', alternate_url: 'https://trudvsem.ru/vacancy/card/demo/501', published_at: new Date(Date.now() - 12 * 86400000).toISOString(), area: { name: 'Нижний Новгород' }, salary: { from: 150000, to: 220000, currency: 'RUR' }, employer: { name: 'Завод «Деталь-НН»' }, description: 'Производство металлоконструкций, 25 лет на рынке. Построить отдел продаж с нуля, подчинение генеральному директору (собственнику).' },
  { id: 'kz-502', name: 'Коммерческий директор', alternate_url: 'https://hh.kz/vacancy/demo502', published_at: new Date(Date.now() - 20 * 86400000).toISOString(), area: { name: 'Алматы' }, salary: { from: 1500000, to: 2500000, currency: 'KZT' }, employer: { name: 'Asia Logistic Group' }, description: 'Логистическая компания, 3 филиала. Нужен коммерческий директор — правая рука собственника, выстроить продажи.' },
];
