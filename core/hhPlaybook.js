// Метод «HH-партизан»: вакансия на hh.ru как повод → честный отклик → короткая переписка
// кандидата на hh → переход в Telegram/WhatsApp → фильтр (объём лидов, собственник на созвоне) →
// аудит 20–30 минут → продажа. Тексты ниже — базовая версия; свои скрипты владелец вставляет в
// Настройках (они хранятся в его базе, а не в публичном репозитории).
import { roleAcc } from './ru.js';
import { addressName } from './util.js';

/** Слова, за которые hh.ru блокирует аккаунт соискателя (п. 4.3.1 соглашения): в переписке на hh — только вопросы кандидата. */
export const HH_FORBIDDEN = [
  ['систем', 'слово «система» звучит как предложение услуг'],
  ['эксперт', '«эксперт» — признак поставщика услуг'],
  ['кейс', 'кейсы — признак поставщика услуг'],
  ['внедр', '«внедрю/внедрение» — предложение услуг'],
  ['делегир', '«делегируете нам» — предложение услуг'],
  ['под ключ', '«под ключ» — предложение услуг'],
  ['аудит', 'слово «аудит» на hh не используем — только после перехода в мессенджер'],
  ['наша компания', '«наша компания» — так пишут подрядчики'],
  ['коммерческое предложение', 'КП на hh не отправляем'],
];

export function hhSafetyCheck(text = '') {
  const low = String(text).toLowerCase();
  const issues = [];
  for (const [w, why] of HH_FORBIDDEN) if (low.includes(w)) issues.push({ level: 'error', msg: `hh.ru: ${why}.` });
  if (/https?:\/\/|t\.me\/|wa\.me\/|@[a-z0-9_]{4,}/i.test(text)) issues.push({ level: 'error', msg: 'hh.ru: никаких ссылок и контактов в переписке — ждём, что контакт даст собеседник.' });
  return issues;
}

/** Флаги вакансии, где решение принимает человек: кодовое слово, тест, анкета, обязательный отраслевой опыт. */
export function vacancyFlags(text = '') {
  const t = String(text);
  const low = t.toLowerCase();
  const flags = [];
  const code = t.match(/(?:кодов[а-яё]*\s+(?:слово|фраз[а-яё]*)|начните\s+(?:сопроводительное|отклик|письмо)[^.]{0,40}?(?:со\s+слов[а-яё]*|с\s+фраз[а-яё]*)|в\s+начале\s+(?:отклика|письма)\s+(?:напишите|укажите))[^«"“]{0,40}[«"“]([^»"”]{1,60})[»"”]/i);
  if (code) flags.push({ id: 'code_word', text: `Кодовое слово в отклике: «${code[1]}»`, value: code[1], human: false });
  else if (/кодов[а-яё]*\s+(слово|фраз)|начните\s+(сопроводительное|отклик|письмо)|в\s+начале\s+(отклика|письма)/i.test(t)) flags.push({ id: 'code_word', text: 'В вакансии есть кодовое слово — прочитайте текст и решите вручную', human: true });
  if (/тестов[а-яё]*\s+задани|пройдите\s+тест|выполните\s+задани|пример\s+кп|приложите\s+(пример|кп)/i.test(low)) flags.push({ id: 'test', text: 'Просят тест или пример КП — решение за вами', human: true });
  if (/анкет/i.test(low)) flags.push({ id: 'form', text: 'Есть анкета — не заполняем без вашего решения', human: true });
  if (/опыт\s+(работы\s+)?(в\s+(сфере|нише|отрасли)|в\s+[а-яё]+\s+от\s+\d|[а-яё]+\s+обязател)/i.test(low)) flags.push({ id: 'industry_exp', text: 'Обязателен отраслевой опыт — оговорите формат честно', human: false });
  if (/только\s+офис|офис\s+обязател|работа\s+в\s+офисе/i.test(low)) flags.push({ id: 'office', text: 'Только офис — ведём к проектному формату', human: false });
  return flags;
}

/** Честный отклик на hh: формат обозначен сразу, вопросы — как у кандидата, без слов-триггеров. */
export function responseLetter({ lead = {}, settings = {} } = {}) {
  const title = lead.vacancy?.title || 'руководителя отдела продаж';
  const flags = vacancyFlags([lead.vacancy?.description, lead.vacancy?.snippet].filter(Boolean).join(' '));
  const code = flags.find(f => f.id === 'code_word' && f.value);
  const custom = settings.playbook?.hhLetter;
  let text = custom && custom.trim()
    ? custom.replace(/\[должность\]|\{должность\}/gi, title).replace(/\[компания\]|\{компания\}/gi, lead.company || '')
    : `Здравствуйте! Откликаюсь на вакансию «${title}».\n\nСразу честно о формате: работаю проектно, как внешний руководитель продаж (ИП), — без испытательного срока и затрат на трудоустройство. Если такой формат для вас возможен, буду рад обсудить.\n\nЧтобы понимать нагрузку: какой сейчас объём лидов в месяц и откуда они приходят? И сколько менеджеров планируете в отделе?`;
  if (code) text = `${code.value}\n\n${text}`;
  return { text, flags, issues: hhSafetyCheck(text) };
}

/** Шаги переписки. channel: hh — пишем как кандидат; messenger — после перехода в Telegram/WhatsApp. */
export function dialogSteps({ lead = {}, slots = [] } = {}) {
  const role = roleAcc(lead.vacancy?.title || 'руководителя отдела продаж');
  const name = addressName(lead.owner?.name || '', true);
  const hi = name ? `${name}, ` : '';
  const slotText = slots.length >= 2 ? `${slots[0].label} или ${slots[1].label}` : 'сегодня в 15:00 или завтра в 11:00 (мск)';
  return [
    { id: 'hh1', channel: 'hh', when: 'Сразу после отклика', title: 'Первое сообщение', text: `Здравствуйте! Откликнулся на вакансию ${role}. Подскажите, пожалуйста, какой сейчас объём лидов в месяц и какого они качества, и сколько менеджеров планируете в отдел? Хочу понимать нагрузку до созвона.` },
    { id: 'hh2a', channel: 'hh', when: 'Ответили цифрами', title: 'Перевод в мессенджер', text: 'Спасибо, понял! Чтобы не терять время в переписке здесь, удобнее продолжить в Telegram или WhatsApp — как вам удобнее? Хочу до встречи уточнить пару моментов по организации работы.', note: 'Свой контакт не отправляем — ждём, что собеседник даст свой.' },
    { id: 'hh2b', channel: 'hh', when: 'Зовут на собеседование без цифр', title: 'Уточнить масштаб', text: 'Конечно, готов. Чтобы прийти подготовленным — подскажите, сколько сейчас лидов в работе у отдела и сколько человек планируете добавить?' },
    { id: 'hh2c', channel: 'hh', when: 'Пишет HR, а не собственник', title: 'Кто проводит встречу', text: 'Подскажите, пожалуйста, кто будет проводить собеседование — сразу руководитель или собственник, или первый этап с вами?' },
    { id: 'hh3', channel: 'hh', when: 'Молчат или уходят от ответа', title: 'Мягкая пауза', text: 'Хорошо, буду ждать. Если появится информация по объёму лидов и планам по найму — напишите, буду рад продолжить.' },
    { id: 'm4', channel: 'messenger', when: 'Если качество лидов не выяснили', title: 'Качество лидов', text: `${hi}уточните, пожалуйста: это заявки с ваших сайтов и рекламы или холодная база? Это важно понять сразу.` },
    { id: 'm5', channel: 'messenger', when: 'Если общаемся с HR', title: 'Собственник на встрече', text: 'Понимаю, что вы закрываете вакансию. Скажу прямо: я не претендую на штатную позицию — у меня проектный формат. По описанию вижу моменты, которые связаны не только с наймом. Обычно показываю их собственнику на короткой встрече — так будет понятно, как я работаю и есть ли смысл сотрудничать. Поэтому важно, чтобы на созвоне был именно собственник.', note: 'Собственник заранее понимает, что ему сделают предложение, — это снимает «ложное собеседование».' },
    { id: 'm6', channel: 'messenger', when: 'Перед назначением встречи', title: 'Фильтр по сроку поиска', text: 'Как давно вы ищете человека на эту позицию?', note: 'Если больше 2–3 месяцев — вероятны завышенные ожидания по рынку; объясните ситуацию на рынке.' },
    { id: 'm7', channel: 'messenger', when: 'Назначение встречи', title: 'Встреча с выбором времени', text: `Предлагаю не растягивать переписку. Проведём короткий аудит на 20–30 минут: посмотрим воронку, работу менеджеров, найм и адаптацию. Покажу, где сейчас могут теряться продажи и действительно ли нужен ещё один сотрудник, или сначала стоит поправить то, что есть. Если увидим, что можем быть полезны, — обсудим формат работы. Если нет — просто дам обратную связь. Могу ${slotText} — какой вариант удобнее?`, note: 'В конце — выбор без выбора.' },
  ];
}

/** Дожим после встречи: день 0 вечером, день 1 днём, день 1 вечером, день 3 — мягкий релиз. */
export function followUpCadence({ lead = {}, painLine = '', caseLinks = [], videoLink = '' } = {}) {
  const name = addressName(lead.owner?.name || '', lead.owner?.style?.formality !== 'ty') || '';
  const hi = name ? `${name}, ` : '';
  const links = caseLinks.filter(Boolean).slice(0, 3);
  return [
    { id: 'f0', when: 'В день встречи, вечером', text: `${hi}спасибо за разговор. Коротко, что увидели: ${painLine || '(цифра-боль: сколько вы теряете сейчас против результата меньшими ресурсами)'}.\n${links.length ? 'Кейсы под вашу ситуацию:\n' + links.map(l => '— ' + l).join('\n') + '\n' : ''}${videoLink ? 'Запись выступления про систему целиком: ' + videoLink + '\n' : ''}Предложение по вашему формату пришлю отдельным файлом. Напишу завтра около 12:00 — узнать, что думаете.`, note: 'Приложите скрин воронки кейса файлом. Перед отправкой проверьте валюту и арифметику.' },
    { id: 'f1', when: 'День 1, днём', text: `${hi}ознакомились? Если формат не ваш — тоже нормально, закрою вопрос для себя.` },
    { id: 'f2', when: 'День 1, вечером (если тишина)', text: `${hi}добавлю ещё один пример похожей задачи: ${links[1] || links[0] || '(ссылка на кейс)'}. Если удобно, обсудим в 15-минутном созвоне.` },
    { id: 'f3', when: 'День 3 — мягкий релиз', text: `${hi}не хочу быть навязчивым. Если сейчас не в приоритете — напишите, когда станет актуально.` },
  ];
}

/** Слоты встречи: ближайшие рабочие дни, время клиента (по умолчанию Москва) и ваше местное. */
export function meetingSlots({ now = new Date(), clientTz = 'Europe/Moscow', myTz = 'Asia/Ho_Chi_Minh', hours = [11, 15, 12], count = 3 } = {}) {
  const out = [];
  const d = new Date(now.getTime());
  let i = 0;
  while (out.length < count && i < 14) {
    d.setUTCDate(d.getUTCDate() + 1); i++;
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: clientTz, weekday: 'short' }).format(d);
    if (wd === 'Sat' || wd === 'Sun') continue;
    const h = hours[out.length % hours.length];
    const at = zonedTime(d, h, clientTz);
    const day = new Intl.DateTimeFormat('ru-RU', { timeZone: clientTz, weekday: 'short', day: 'numeric', month: 'short' }).format(at);
    const mine = new Intl.DateTimeFormat('ru-RU', { timeZone: myTz, hour: '2-digit', minute: '2-digit' }).format(at);
    out.push({ at: at.toISOString(), label: `${day} в ${String(h).padStart(2, '0')}:00 мск`, mine: `${mine} по вашему времени` });
  }
  return out;
}

/** Момент времени: дата d (по UTC) в часовом поясе tz в hh:00. */
function zonedTime(d, hour, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(p => [p.type, p.value]));
  const guess = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, 0, 0));
  const tzHour = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(guess);
  const diff = tzHour - hour;
  return new Date(guess.getTime() - diff * 3600_000);
}

/** Шаблон фиксации встречи (как в скрипте менеджера). */
export function meetingRecord(lead = {}, at) {
  const leadsPerMonth = (lead.facts || []).map(f => f.text.match(/(\d+)\s*(лид|заяв)/i)).find(Boolean)?.[1] || '___';
  return `${lead.company || '[Компания]'} — лидов ${leadsPerMonth}/мес, ищут ${roleAcc(lead.vacancy?.title || 'РОПа')}\nВакансия: ${lead.vacancy?.url || '[ссылка]'}\nВстреча: ${at ? new Date(at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' мск' : '[дата, время]'}\nСтатус: назначена`;
}
