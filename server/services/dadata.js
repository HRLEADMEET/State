// ЕГРЮЛ через DaData (официальные данные ФНС): руководитель, дата регистрации, численность.
// Бесплатный ключ: dadata.ru → Личный кабинет → API-ключ. Лимит бесплатного тарифа — 10 000 запросов в день.
import { config } from '../config.js';

export function dadataService(getChannelConfig) {
  return {
    async findCompany(ctx, { query, city }) {
      const c = await getChannelConfig(ctx, 'dadata');
      const key = c?.apiKey || process.env.DADATA_API_KEY;
      if (!key || c?.enabled === false) return null;
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), config.fetchTimeoutMs);
      try {
        const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/party', {
          method: 'POST', signal: ctl.signal,
          headers: { Authorization: 'Token ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query: String(query).slice(0, 300), count: 1, ...(city ? { locations: [{ city }] } : {}), status: ['ACTIVE'] }),
        });
        if (!res.ok) throw new Error('DaData: HTTP ' + res.status);
        const d = (await res.json()).suggestions?.[0]?.data;
        if (!d) return null;
        return { inn: d.inn, director: d.management?.name || null, directorPost: d.management?.post || null, registered: d.state?.registration_date ? new Date(d.state.registration_date).toISOString() : null, employees: d.employee_count || null, okved: d.okved || null };
      } finally { clearTimeout(t); }
    },
  };
}
