// Где искать клиентов: каталог источников и подбор под нишу и оффер.
// mode: api — сервер ищет сам (ключ или бесплатно); csv — выгрузка/список; manual — живая работа человека по готовому тексту.
// approach: HH-партизан (вакансия как повод) или Харви (холодная почта по открытым данным бизнеса).
export const SOURCES = [
  { id: 'hh', group: 'Площадки вакансий', name: 'hh.ru', mode: 'api', approach: 'hh', cost: 'бесплатно (API)', signal: 'Ищут РОПа, коммерческого директора, ассистента собственника', niches: ['all'] },
  { id: 'hh_kz', group: 'Площадки вакансий', name: 'hh.kz', mode: 'api', approach: 'hh', cost: 'бесплатно (API, host=hh.kz)', signal: 'То же для Казахстана', niches: ['all'], markets: ['KZ'] },
  { id: 'trudvsem', group: 'Площадки вакансий', name: 'Работа России (trudvsem.ru)', mode: 'api', approach: 'hh', cost: 'бесплатно (открытые данные)', signal: 'Вакансии руководителей продаж, часто регионы и производство', niches: ['b2b', 'realty', 'services', 'all'] },
  { id: 'superjob', group: 'Площадки вакансий', name: 'SuperJob', mode: 'api', approach: 'hh', cost: 'бесплатный ключ API', signal: 'Вакансии топ-позиций, МСБ', niches: ['all'] },
  { id: 'avito_jobs', group: 'Площадки вакансий', name: 'Авито Работа', mode: 'manual', approach: 'hh', cost: 'бесплатно', signal: 'Малый бизнес, собственники часто пишут сами', niches: ['services', 'realty', 'dental'] },
  { id: 'zarplata', group: 'Площадки вакансий', name: 'Зарплата.ру, Rabota.ru', mode: 'manual', approach: 'hh', cost: 'бесплатно', signal: 'Региональный бизнес', niches: ['all'] },
  { id: 'twogis', group: 'Карты и справочники', name: '2ГИС', mode: 'api', approach: 'harvey', cost: 'ключ API 2ГИС', signal: 'Компании ниши в городе: сайт, телефон, рейтинг, филиалы', niches: ['dental', 'services', 'realty', 'coach', 'all'] },
  { id: 'yandex_maps', group: 'Карты и справочники', name: 'Яндекс Карты (поиск организаций)', mode: 'api', approach: 'harvey', cost: 'ключ API (платный тариф)', signal: 'Организации по рубрике и городу, сайт и телефон', niches: ['dental', 'services', 'all'] },
  { id: 'google_places', group: 'Карты и справочники', name: 'Google Maps (Places)', mode: 'api', approach: 'harvey', cost: 'ключ Google, ~$0,03 за запрос', signal: 'Вьетнам, ОАЭ, Турция, Европа — международные рынки', niches: ['all'], markets: ['VN', 'AE', 'TR', 'INT'] },
  { id: 'egrul', group: 'Открытые реестры', name: 'ЕГРЮЛ / DaData', mode: 'api', approach: 'harvey', cost: 'бесплатно до 10 000 запросов в день', signal: 'Руководитель, численность, дата регистрации — квалификация', niches: ['all'] },
  { id: 'sites', group: 'Открытый интернет', name: 'Сайты компаний (список доменов)', mode: 'csv', approach: 'harvey', cost: 'бесплатно', signal: 'Страница команды, вакансии на сайте, онлайн-чат, CRM-виджет', niches: ['all'] },
  { id: 'ats', group: 'Открытый интернет', name: 'Вакансии на сайтах компаний (Greenhouse, Lever, Huntflow)', mode: 'api', approach: 'harvey', cost: 'бесплатно', signal: 'Растут: открыты роли в продажах', niches: ['it'] },
  { id: 'tg_chats', group: 'Сообщества', name: 'Чаты собственников и руководителей (Telegram, VK)', mode: 'manual', approach: 'hh', cost: 'бесплатно', signal: 'Вопросы «посоветуйте РОПа», «как построить отдел»', niches: ['all'] },
  { id: 'pro_chats', group: 'Сообщества', name: 'Чаты коучей, психологов, стоматологов, IT', mode: 'manual', approach: 'hh', cost: 'бесплатно', signal: 'Эксперты с высоким чеком без отдела продаж', niches: ['coach', 'dental', 'it'] },
  { id: 'marketplaces', group: 'Открытый интернет', name: 'Продавцы маркетплейсов (WB, Ozon)', mode: 'csv', approach: 'harvey', cost: 'бесплатно', signal: 'Оборот растёт — нужен B2B-отдел и опт', niches: ['b2b'] },
  { id: 'events', group: 'Офлайн и мероприятия', name: 'Выставки и конференции (списки участников)', mode: 'csv', approach: 'harvey', cost: 'бесплатно', signal: 'Компании, которые вкладываются в рост', niches: ['b2b', 'it', 'realty'] },
  { id: 'ads', group: 'Реклама', name: 'Яндекс Директ, VK, TikTok, Meta (заявки)', mode: 'api', approach: 'inbound', cost: 'рекламный бюджет', signal: 'Входящие заявки на аудит', niches: ['all'] },
  { id: 'referrals', group: 'Рекомендации', name: 'Агенты и рекомендации', mode: 'manual', approach: 'inbound', cost: '% агенту с оплаты', signal: 'Тёплые лиды от партнёров', niches: ['all'] },
];

export const APPROACHES = {
  hh: { name: 'HH-партизан', idea: 'Вакансия → честный отклик или прямой выход на собственника → мессенджер → аудит' },
  harvey: { name: 'Харви: почта', idea: 'Открытые данные бизнеса → сигнал → персональное письмо из 2 касаний → ответ → встреча' },
  inbound: { name: 'Входящие', idea: 'Реклама и рекомендации → заявка → аудит' },
};

/** Подбор источников под нишу и рынок: сначала бесплатные API, потом карты, потом ручные. */
export function recommendSources({ niche = 'all', market = 'RU', budget = 'low' } = {}) {
  const score = (s) => {
    let v = 0;
    if (s.niches.includes(niche)) v += 3; else if (s.niches.includes('all')) v += 1;
    if (s.markets && !s.markets.includes(market) && !(market === 'RU' && !s.markets)) v -= 3;
    if (!s.markets && market !== 'RU' && ['hh', 'trudvsem', 'superjob', 'avito_jobs', 'zarplata', 'egrul', 'yandex_maps', 'twogis'].includes(s.id)) v -= 2;
    if (s.mode === 'api') v += 1;
    if (budget === 'low' && /бесплатно/.test(s.cost)) v += 1;
    return v;
  };
  return SOURCES.map(s => ({ ...s, fit: score(s) })).filter(s => s.fit > 0).sort((a, b) => b.fit - a.fit);
}

/** Нормализация найденной организации (карты, справочники) в лида для режима Харви. */
export function orgToLead(o = {}, source = 'maps') {
  return {
    company: String(o.name || '').slice(0, 300), site: o.site || '', city: o.city || '', industry: o.niche || '',
    source, approach: 'harvey', score: 50 + (o.site ? 10 : 0) + (o.rating && o.rating < 4.5 ? 5 : 0) + (o.branches > 1 ? 10 : 0),
    contacts: { phones: o.phone ? [o.phone] : [], emails: o.email ? [o.email] : [] },
    facts: [o.address ? { kind: 'map', text: `адрес: ${o.address}`, source } : null, o.rating ? { kind: 'map', text: `рейтинг на картах ${o.rating}${o.reviews ? `, отзывов ${o.reviews}` : ''}`, source } : null, o.branches > 1 ? { kind: 'map', text: `филиалов: ${o.branches}`, source } : null].filter(Boolean),
    hypotheses: [{ pain: 'Поток заявок есть, но продажи держатся на собственнике — нет системы.', offerId: 'audit' }],
    owner: { name: '', role: '', social: {} }, sourceRef: o.id ? `${source}:${o.id}` : undefined,
  };
}
