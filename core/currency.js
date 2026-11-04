// Валюты целевых рынков. Курсы — «рублей за 1 единицу валюты» (как у ЦБ РФ); на сервере обновляются с cbr-xml-daily.ru,
// без сети — используются ориентировочные значения ниже (обновите в Настройках, если считаете для клиента).
export const CURRENCIES = [
  { code: 'RUB', name: 'Россия · рубль', symbol: '₽', rate: 1 },
  { code: 'USD', name: 'США · доллар', symbol: '$', rate: 92 },
  { code: 'EUR', name: 'Еврозона · евро', symbol: '€', rate: 100 },
  { code: 'KZT', name: 'Казахстан · тенге', symbol: '₸', rate: 0.18 },
  { code: 'VND', name: 'Вьетнам · донг', symbol: '₫', rate: 0.0036 },
  { code: 'CNY', name: 'Китай · юань', symbol: '¥', rate: 12.7 },
  { code: 'AED', name: 'ОАЭ · дирхам', symbol: 'AED', rate: 25 },
  { code: 'TRY', name: 'Турция · лира', symbol: '₺', rate: 2.7 },
  { code: 'GBP', name: 'Великобритания · фунт', symbol: '£', rate: 117 },
  { code: 'INR', name: 'Индия · рупия', symbol: '₹', rate: 1.1 },
  { code: 'THB', name: 'Таиланд · бат', symbol: '฿', rate: 2.6 },
  { code: 'IDR', name: 'Индонезия · рупия', symbol: 'Rp', rate: 0.0058 },
  { code: 'UZS', name: 'Узбекистан · сум', symbol: 'сум', rate: 0.0072 },
  { code: 'KGS', name: 'Киргизия · сом', symbol: 'сом', rate: 1.05 },
  { code: 'BYN', name: 'Беларусь · рубль', symbol: 'Br', rate: 28 },
  { code: 'AMD', name: 'Армения · драм', symbol: '֏', rate: 0.23 },
  { code: 'GEL', name: 'Грузия · лари', symbol: '₾', rate: 34 },
  { code: 'BRL', name: 'Бразилия · реал', symbol: 'R$', rate: 16 },
];

export function rateOf(code, rates = {}) {
  if (code === 'RUB') return 1;
  return Number(rates[code]) || CURRENCIES.find(c => c.code === code)?.rate || 1;
}

export function convert(rub, code, rates = {}) { return (Number(rub) || 0) / rateOf(code, rates); }

export function fmtCur(amount, code) {
  const c = CURRENCIES.find(x => x.code === code) || { symbol: code };
  const v = Math.round(Number(amount) || 0).toLocaleString('ru-RU').replace(/[\s,]/g, ' ');
  return c.symbol === '$' || c.symbol === '€' || c.symbol === '£' ? `${c.symbol}${v}` : `${v} ${c.symbol}`;
}

/** Цена в рублях → таблица по рынкам (для прайса клиенту в его валюте). */
export function priceInMarkets(rub, codes = CURRENCIES.map(c => c.code), rates = {}) {
  return codes.map(code => ({ code, name: CURRENCIES.find(c => c.code === code)?.name || code, amount: Math.round(convert(rub, code, rates)), text: fmtCur(convert(rub, code, rates), code) }));
}

/** Разбор ответа ЦБ (daily_json.js): Value за Nominal единиц. */
export function ratesFromCbr(json) {
  const out = {};
  for (const [code, v] of Object.entries(json?.Valute || {})) if (v?.Value && v?.Nominal) out[code] = v.Value / v.Nominal;
  return out;
}
