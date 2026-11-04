// Источники клиентов кроме hh.ru: Работа России (бесплатно), SuperJob, hh.kz, 2ГИС, Яндекс Карты, Google Places.
// Только официальные API и открытые данные; ключи — в «Каналы» или .env. Результат приводится к виду «вакансия» или «организация».
import { config } from '../config.js';

async function getJson(url, { headers = {}, method = 'GET', body } = {}) {
  const res = await fetch(url, { method, headers: { Accept: 'application/json', ...headers }, body, signal: AbortSignal.timeout(config.fetchTimeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  return res.json();
}

export function sourcesService(getChannelConfig, hh) {
  const key = async (ctx, type, envName) => (await getChannelConfig(ctx, type))?.apiKey || process.env[envName] || '';
  return {
    // Вакансии → формат hh, чтобы работал общий скоринг и плейбук.
    async hh_kz(ctx, { query }) { const r = await hh.search(ctx, { text: `NAME:(${query})`, host: 'hh.kz', per_page: 50, order_by: 'publication_time' }); return { kind: 'vacancy', items: r.items || [] }; },
    async trudvsem(ctx, { query, city }) {
      const j = await getJson('https://opendata.trudvsem.ru/api/v1/vacancies?' + new URLSearchParams({ text: query, limit: '50' }));
      const items = (j.results?.vacancies || []).map(x => x.vacancy).filter(v => !city || String(v.region?.name || v.addresses?.address?.[0]?.location || '').toLowerCase().includes(String(city).toLowerCase()))
        .map(v => ({ id: 'tv-' + v.id, name: v['job-name'], alternate_url: v.vac_url, published_at: v['creation-date'], area: { name: v.region?.name || '' }, salary: { from: v.salary_min || null, to: v.salary_max || null, currency: 'RUR' }, employer: { name: v.company?.name || '' }, description: [v.duty, v.requirement?.qualification].filter(Boolean).join(' ') }));
      return { kind: 'vacancy', items };
    },
    async superjob(ctx, { query, city }) {
      const k = await key(ctx, 'superjob', 'SUPERJOB_API_KEY'); if (!k) throw new Error('Нужен ключ SuperJob (api.superjob.ru) в «Каналах».');
      const j = await getJson('https://api.superjob.ru/2.0/vacancies/?' + new URLSearchParams({ keyword: query, count: '50', ...(city ? { town: city } : {}) }), { headers: { 'X-Api-App-Id': k } });
      return { kind: 'vacancy', items: (j.objects || []).map(v => ({ id: 'sj-' + v.id, name: v.profession, alternate_url: v.link, published_at: v.date_published ? new Date(v.date_published * 1000).toISOString() : null, area: { name: v.town?.title || '' }, salary: { from: v.payment_from || null, to: v.payment_to || null, currency: 'RUR' }, employer: { name: v.firm_name || '' }, description: v.candidat || '' })) };
    },
    // Организации на картах → режим Харви.
    async twogis(ctx, { query, city }) {
      const k = await key(ctx, 'twogis', 'TWOGIS_API_KEY'); if (!k) throw new Error('Нужен ключ 2ГИС в «Каналах».');
      const j = await getJson('https://catalog.api.2gis.com/3.0/items?' + new URLSearchParams({ q: [query, city].filter(Boolean).join(' '), fields: 'items.contact_groups,items.reviews,items.org,items.address', page_size: '50', key: k }));
      return { kind: 'org', items: (j.result?.items || []).map(o => { const c = (o.contact_groups || []).flatMap(g => g.contacts || []); return { id: o.id, name: o.name, address: o.address_name, city, site: c.find(x => x.type === 'website')?.text || '', phone: c.find(x => x.type === 'phone')?.text || '', email: c.find(x => x.type === 'email')?.text || '', rating: o.reviews?.general_rating, reviews: o.reviews?.general_review_count, branches: o.org?.branch_count }; }) };
    },
    async yandex_maps(ctx, { query, city }) {
      const k = await key(ctx, 'yandex_maps', 'YANDEX_ORGS_API_KEY'); if (!k) throw new Error('Нужен ключ API поиска по организациям Яндекса в «Каналах».');
      const j = await getJson('https://search-maps.yandex.ru/v1/?' + new URLSearchParams({ text: [query, city].filter(Boolean).join(' '), type: 'biz', lang: 'ru_RU', results: '50', apikey: k }));
      return { kind: 'org', items: (j.features || []).map(f => { const m = f.properties?.CompanyMetaData || {}; return { id: m.id, name: m.name, address: m.address, city, site: m.url || '', phone: m.Phones?.[0]?.formatted || '' }; }) };
    },
    async google_places(ctx, { query, city }) {
      const k = await key(ctx, 'google_places', 'GOOGLE_PLACES_API_KEY'); if (!k) throw new Error('Нужен ключ Google Places в «Каналах».');
      const j = await getJson('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': k, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.rating,places.userRatingCount' }, body: JSON.stringify({ textQuery: [query, city].filter(Boolean).join(' '), pageSize: 20 }) });
      return { kind: 'org', items: (j.places || []).map(p => ({ id: p.id, name: p.displayName?.text, address: p.formattedAddress, city, site: p.websiteUri || '', phone: p.internationalPhoneNumber || '', rating: p.rating, reviews: p.userRatingCount })) };
    },
  };
}
