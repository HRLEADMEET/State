// Генератор первых касаний и дожимов. Шаблонный движок работает без ИИ и без сети;
// при наличии ключа Claude сервер переписывает черновик глубже (см. server/services/llm.js),
// но факты и доказательства всегда берутся только из карточки лида и из PROOFS — без выдумок.
import { PROOFS, BRAND, DEFAULT_OFFERS } from './catalog.js';
import { applyStyle } from './stylometry.js';
import { addressName, pick, fmtRub } from './util.js';
import { roleAcc, plural } from './ru.js';
export { roleAcc, plural };

export const HOOKS = [
  { id: 'vacancy', name: 'Зацепка за вакансию', idea: 'Увидел вакансию → понимаю, зачем она → короткое доказательство → вопрос.' },
  { id: 'facts', name: '«Задайте любой вопрос о своей компании»', idea: 'Показываю, что уже изучил компанию; предлагаю проверить меня.' },
  { id: 'inaction', name: 'Цена бездействия в рублях', idea: 'Считаю, сколько стоит открытая вакансия, и предлагаю способ быстрее.' },
  { id: 'system', name: '«Вас нашла моя система — хотите такую же?»', idea: 'Мета-оффер: сама переписка — демонстрация продукта.' },
  { id: 'case', name: 'Кейс из похожей ниши', idea: 'Конкретный кейс с цифрами + перенос на их ситуацию.' },
  { id: 'post', name: 'Отклик на пост собственника', idea: 'Реакция на мысль из его поста → мост к теме → вопрос.' },
];

const SUBJECTS = {
  vacancy: ['вопрос про поиск {role}', '{company}: про поиск {role}', 'про поиск {role}'],
  facts: ['{company} — 3 факта и 1 вопрос', 'проверьте меня', 'вопрос по {company}'],
  inaction: ['посчитал вашу вакансию', '{company}: сколько стоит пустое место {role}', 'цифра по {company}'],
  system: ['как я вас нашёл', 'эту переписку собрала система', 'про систему, которая вас нашла'],
  case: ['кейс: {proof}', 'похожая задача, как у {company}', '{company} и кейс с цифрами'],
  post: ['про ваш пост', 'по вашему посту', 'мысль из вашего поста'],
};

function fill(tpl, v) { return tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''); }

function chooseProof(lead, seed, casesOnly = false, proofs = PROOFS) {
  const niche = lead.industry || 'sales';
  const all = proofs && proofs.length ? proofs : null;
  if (!all) return { id: 'none', short: 'опыт в похожих задачах', text: 'мы решали похожие задачи — расскажу на созвоне', niche: ['all'] };
  const pool = casesOnly && all.some(p => p.isCase) ? all.filter(p => p.isCase) : all;
  const fit = pool.filter(p => p.niche.includes(niche) || p.niche.includes('all') || p.niche.includes('sales'));
  return pick(fit.length ? fit : pool, seed);
}

function roleOf(lead) { return roleAcc(lead.vacancy?.title || ''); }

/** Основная функция: черновик касания. */
export function draftMessage({ lead, me = {}, hook = 'vacancy', channel = 'email', offer, seed, variant, proofs = PROOFS } = {}) {
  const s = seed ?? (lead.id || '') + hook + channel;
  const ownerStyle = lead.owner?.style;
  const formal = !ownerStyle || ownerStyle.formality !== 'ty';
  const name = addressName(lead.owner?.name || '', formal);
  const hello = name ? (formal ? `${name}, добрый день.` : `${name}, привет.`) : (formal ? 'Добрый день.' : 'Привет.');
  const company = lead.company || 'вашей компании';
  const role = roleOf(lead);
  const proof = chooseProof(lead, s, hook === 'case' || hook === 'vacancy', proofs);
  const facts = (lead.facts || []).filter(f => f.text);
  const siteFacts = facts.filter(f => f.kind?.startsWith('site'));
  const of = offer || DEFAULT_OFFERS.find(o => o.id === (lead.hypotheses?.[0]?.offerId)) || DEFAULT_OFFERS[0];
  const pain = lead.hypotheses?.[0]?.pain;
  const myName = me.name || BRAND.person;
  const lines = [hello];
  const used = { facts: [], proof: proof.id };

  switch (hook) {
    case 'vacancy': {
      const ageF = facts.find(f => f.kind === 'vacancy_age');
      lines.push(`Увидел, что ${company} ищет ${role}${ageF && ageF.days >= 14 ? ` — и что вакансия открыта уже ${ageF.days} дн.` : '.'}`);
      if (ageF) used.facts.push(ageF.text);
      lines.push(pain ? `Обычно это значит одно: ${lower(pain)}` : 'Обычно такую позицию ищут, когда рост упёрся в систему, а не в людей.');
      lines.push(`Я строю отделы продаж и найм под ключ — например, ${proof.text}.`);
      lines.push(`Могу за 30 минут показать, где сейчас теряются ваши лиды и кого на самом деле стоит нанимать первым. Актуально?`);
      break;
    }
    case 'facts': {
      const pickF = [...siteFacts, ...facts.filter(f => !f.kind?.startsWith('site'))].slice(0, 3);
      used.facts.push(...pickF.map(f => f.text));
      lines.push(`Прежде чем писать, я изучил ${company}:\n` + (pickF.length ? pickF.map(f => `— ${f.text}`).join('\n') : '— сайт, вакансии и то, как вы продаёте.'));
      lines.push(`Задайте мне любой вопрос о своей компании — отвечу здесь. Если попаду — созвонимся на 30 минут, и я покажу, где у вас теряются деньги в продажах.`);
      break;
    }
    case 'inaction': {
      const c = lead.inaction || {};
      const n = c.managers || 3;
      const cpm = (proofs || []).find(p => p.id === 'cpm') || proof;
      used.proof = cpm.id;
      lines.push(`Посчитал по открытым данным: пока нет ${role}, ${company} недобирает примерно ${fmtRub(c.lostPerMonthRub || 450000)} в месяц.`);
      lines.push(`Расчёт грубый: ${n} ${plural(n, 'менеджер', 'менеджера', 'менеджеров')} × план × 25% недоработки без руководителя. Ошибка найма на такую позицию — ещё около ${fmtRub(c.badHireRiskRub || 450000)}.`);
      lines.push(`Я считаю цену результата, а не «стоимость подбора»: у меня ${cpm.text}.`);
      lines.push('Показать на ваших цифрах, как сократить этот срок? Хватит 30 минут.');
      break;
    }
    case 'system': {
      const f = facts[0];
      lines.push(`Скажу честно, как я вас нашёл: моя система сама нашла ${company} по сигналу${f ? ` (${f.text})` : ''}, изучила открытые данные и подготовила это сообщение — а я проверил и отправил лично.`);
      lines.push('Такую же систему я ставлю собственникам: она находит клиентов, пишет им на их языке и готовит меня к каждой встрече.');
      lines.push(`Показать на созвоне, как она нашла бы клиентов именно для ${company}? 20 минут, без презентаций.`);
      break;
    }
    case 'case': {
      lines.push(`Пишу, потому что у ${company} похожая ситуация на один из моих проектов: ${proof.text}.`);
      lines.push(pain ? `Судя по открытым данным, у вас сейчас: ${lower(pain)}` : 'Судя по открытым данным, у вас сейчас похожая точка роста.');
      lines.push('Расскажу за 30 минут, что из этого переносится на вас, а что нет. Удобно на этой неделе?');
      break;
    }
    case 'post': {
      const posts = lead.owner?.posts?.length ? lead.owner.posts : [lead.owner?.lastPost || ''];
      const best = posts.slice(-4).flatMap(p => String(p).split(/(?<=[.!?])\s+/)).filter(x => x.length >= 35 && x.length <= 160).sort((a, b) => b.length - a.length)[0] || '';
      const quote = best ? '«' + best.trim() + '»' : 'ваш последний пост';
      lines.push(`Прочитал ${quote} — откликнулось.`);
      lines.push(`У меня похожий опыт: ${proof.text}.`);
      lines.push(pain ? `И вижу у ${company} ещё одну точку роста: ${lower(pain)}` : `Есть мысль, как это применить к ${company}.`);
      lines.push('Обменяемся опытом за 20 минут?');
      break;
    }
    default: lines.push('…');
  }

  let body = lines.join('\n\n');
  const signature = me.signature || `${myName}\n${BRAND.title}\nTelegram: ${me.telegram || BRAND.telegram}`;
  if (channel === 'email') body += `\n\n${signature}` + `\n\nP.S. Если тема неактуальна — ответьте «нет», и я больше не напишу.`;
  if (channel === 'telegram' || channel === 'whatsapp' || channel === 'zalo') body = body.replace(/\n\n/g, '\n');
  body = applyStyle(body, ownerStyle);

  const subj = channel === 'email'
    ? fill(pick(SUBJECTS[hook] || SUBJECTS.vacancy, s), { company, role, proof: proof.short.toLowerCase(), niche: 'вашей ниши' })
    : '';
  return { subject: subj, body, hook, channel, offerId: of.id, proofId: proof.id, used, variant: variant || null, words: body.split(/\s+/).length };
}

/** Дожимы: короткие, по одному на 3-й и 7-й день, без давления. */
export function followUp({ lead, step = 1, channel = 'email', me = {}, proofs = PROOFS }) {
  const formal = lead.owner?.style?.formality !== 'ty';
  const name = addressName(lead.owner?.name || '', formal);
  const proof = chooseProof(lead, (lead.id || '') + 'fu' + step, false, proofs);
  const texts = {
    1: `${name ? name + ', ' : ''}поднимаю письмо — вдруг утонуло. Если коротко: могу за 30 минут показать, где у ${lead.company || 'вас'} теряются лиды. Есть смысл созвониться?`,
    2: `${name ? name + ', ' : ''}последнее сообщение, чтобы не надоедать. Оставлю кейс: ${proof.text}. Если станет актуально — просто ответьте на это письмо.`,
  };
  let body = applyStyle(texts[step] || texts[2], lead.owner?.style);
  if (channel === 'email') body += `\n\n${me.name || BRAND.person}`;
  return { subject: step === 1 ? 'Re: ' : 'Re: ', body, hook: 'followup' + step, channel };
}

/** Ответы на типовые реакции — с сохранением тона собственника. */
export const REPLY_PLAYBOOK = {
  positive: 'Отлично! Предлагаю 30 минут: {slots}. Какое время удобнее? Пришлю ссылку на звонок.',
  question: 'Хороший вопрос. Коротко: {answer}. Подробно и на ваших цифрах — лучше голосом, 20–30 минут. Когда удобно?',
  price: 'Цена зависит от задачи: от аудита (бесплатно) до системы под ключ. Сначала 30 минут — пойму, что вам реально нужно; часто хватает меньшего. Удобно {slots}?',
  later: 'Понял, не тороплю. Когда лучше вернуться к теме — через месяц? Поставлю себе напоминание.',
  have_contractor: 'Здорово, что процесс уже идёт. Могу дать независимый взгляд: 30 минут, разберу воронку по цифрам — если всё хорошо, просто подтвержу это.',
  negative: 'Понял, спасибо за ответ. Больше не беспокою. Если станет актуально — я на связи.',
  unsubscribe: '',
};

export function lower(s = '') { return s ? s[0].toLowerCase() + s.slice(1) : s; }
