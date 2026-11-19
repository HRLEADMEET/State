// Разбор звонка по расшифровке: доля речи, вопросы, этапы скрипта, возражения, следующий шаг.
// Работает без ИИ. С ключом Claude сервер добавляет глубокий разбор поверх этих метрик.
import { round } from './util.js';

const STAGE_SIGNALS = {
  frame: [/у нас (есть )?\d+\s*минут/, /предлагаю так/, /договорились\?/, /в конце (честно )?скажу/],
  wow: [/я подготовил/, /я посмотрел/, /изучил/, /увидел, что/, /что из этого неверно/],
  situation: [/сколько (заявок|лидов|менеджер|человек)/, /средний чек/, /цикл сделки/, /кто (сейчас )?управляет/],
  problem: [/где (вы )?теряете/, /на каком этапе/, /что мешает/, /почему (вакансия|не получается)/],
  implication: [/если ничего не (менять|делать)/, /во сколько (обошлась|обойдётся)/, /сколько (это|вы) (теряете|в выручке)/, /что будет, если/],
  payoff: [/что бы это дало/, /если бы/, /назвали успехом/, /куда бы вы/],
  offer: [/стоимость/, /стоит \d/, /предлагаю/, /вариант/, /тариф/, /\d+\s*(тысяч|000|₽|руб)/],
  close: [/как удобнее/, /сразу без наценки/, /рассрочк/, /когда стартуем/, /выставляю счёт/],
  next: [/пришлю (договор|счёт|счет)/, /созвонимся (в|во|завтра)/, /следующ(ий|ая) (шаг|встреча)/, /\d{1,2}[:.]\d{2}/],
};
const OBJ_SIGNALS = {
  price: /дорого|дороговато|не потянем|бюджет(а)? нет|денег нет/,
  think: /подумать|подумаю|обдумать/,
  partner: /партн[её]р|посоветоваться|обсудить с/,
  time: /нет времени|некогда|не до этого/,
  contractor: /уже есть (подрядчик|роп|агентство)|работаем с/,
  tried: /пробовали|не сработало|уже было/,
  guarantee: /гаранти/,
  diy: /сами (сделаем|справимся)|своими силами/,
};
const PAIN_RE = /(теря|не выполня|не можем|проблем|сложно|не получается|уход|текучк|нет системы|хаос|сам(и)? всё|не хватает|узк(ое|ое место))/i;

export function parseTranscript(text = '') {
  const turns = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([^:]{1,40}):\s*(.+)$/);
    if (m) turns.push({ speaker: m[1].trim(), text: m[2].trim() });
    else if (line.trim() && turns.length) turns[turns.length - 1].text += ' ' + line.trim();
    else if (line.trim()) turns.push({ speaker: '?', text: line.trim() });
  }
  return turns;
}

export const MAX_TRANSCRIPT_CHARS = 300_000; // ~4–5 часов разговора; больше — обрезаем, чтобы один запрос не останавливал сервер

export function analyzeCall(text, { me = ['влад', 'я', 'менеджер', 'консультант', 'продавец', 'speaker 1', 'спикер 1'] } = {}) {
  const turns = parseTranscript(String(text || '').slice(0, MAX_TRANSCRIPT_CHARS)).slice(0, 6000);
  if (!turns.length) return { ok: false, reason: 'Пустая расшифровка.' };
  const speakers = [...new Set(turns.map(t => t.speaker))];
  const meLabels = me.map(x => x.toLowerCase());
  let mine = speakers.find(s => meLabels.some(m => s.toLowerCase().includes(m)));
  if (!mine) mine = turns[0].speaker; // по умолчанию — тот, кто начал разговор
  const wc = (s) => s.split(/\s+/).filter(Boolean).length;
  let myWords = 0, theirWords = 0, myQuestions = 0, longest = 0;
  const stagesHit = {}; const objections = []; const pains = []; const quotes = [];
  // Индекс следующей реплики «моей» стороны — за один проход с конца (O(n) вместо O(n²)).
  const nextMine = new Array(turns.length).fill(-1);
  for (let j = turns.length - 2; j >= 0; j--) nextMine[j] = turns[j + 1].speaker === mine ? j + 1 : nextMine[j + 1];
  turns.forEach((t, i) => {
    const w = wc(t.text); const low = t.text.toLowerCase();
    if (t.speaker === mine) {
      myWords += w; longest = Math.max(longest, w);
      myQuestions += (t.text.match(/\?/g) || []).length;
      for (const [st, res] of Object.entries(STAGE_SIGNALS)) if (res.some(r => r.test(low))) stagesHit[st] = (stagesHit[st] || 0) + 1;
    } else {
      theirWords += w;
      for (const [id, re] of Object.entries(OBJ_SIGNALS)) if (objections.length < 50 && re.test(low)) {
        const reply = nextMine[i] >= 0 ? turns[nextMine[i]] : null;
        objections.push({ id, text: t.text, handled: !!reply && wc(reply.text) > 8 && /\?/.test(reply.text), reply: reply?.text || '' });
      }
      if (PAIN_RE.test(t.text)) pains.push(t.text);
      if (w >= 12) quotes.push(t.text);
    }
  });
  const total = myWords + theirWords || 1;
  const talkRatio = round((myWords / total) * 100);
  const covered = Object.keys(STAGE_SIGNALS).filter(s => stagesHit[s]);
  const missing = Object.keys(STAGE_SIGNALS).filter(s => !stagesHit[s]);
  const nextStep = !!stagesHit.next;
  const closeAsked = !!stagesHit.close;

  let score = 40;
  score += talkRatio >= 30 && talkRatio <= 55 ? 15 : talkRatio <= 65 ? 5 : -10;
  score += myQuestions >= 11 && myQuestions <= 20 ? 15 : myQuestions >= 6 ? 8 : 0;
  score += covered.length * 3;
  score += nextStep ? 8 : -5;
  score += closeAsked ? 5 : 0;
  score -= objections.filter(o => !o.handled).length * 5;
  score = Math.max(0, Math.min(100, score));

  const recs = [];
  if (talkRatio > 55) recs.push(`Вы говорили ${talkRatio}% времени — дайте собственнику говорить больше (цель 40–50%).`);
  if (talkRatio < 30) recs.push('Вы говорили меньше 30% — возможно, не провели к решению. Больше рамки и резюме.');
  if (myQuestions < 11) recs.push(`Вопросов: ${myQuestions}. Цель 11–14 — особенно про последствия (I) и выгоду (N).`);
  if (longest > 150) recs.push(`Самый длинный монолог — ${longest} слов. Режьте на куски по 60–80 слов с вопросом в конце.`);
  const names = { frame: 'рамка', wow: 'факты о компании', situation: 'ситуация', problem: 'проблема', implication: 'последствия в деньгах', payoff: 'выгода его словами', offer: 'предложение', close: 'закрывающий вопрос', next: 'следующий шаг' };
  if (missing.length) recs.push('Пропущены этапы: ' + missing.map(m => names[m]).join(', ') + '.');
  for (const o of objections.filter(x => !x.handled)) recs.push(`Возражение «${o.text.slice(0, 60)}» осталось без уточняющего вопроса.`);
  if (!nextStep) recs.push('Нет конкретного следующего шага (дата, счёт, договор). Это главный пункт для дожима.');

  return {
    ok: true, speakers, me: mine, turns: turns.length,
    talkRatio, myQuestions, longestMonologue: longest,
    stages: { covered, missing }, objections, pains: pains.slice(0, 6), quotes: quotes.slice(0, 5),
    nextStep, closeAsked, score, recommendations: recs,
  };
}

/** Самообучение: сводка по всем звонкам — частые возражения, слабые этапы, лучшие формулировки. */
export function learnFromCalls(analyses = []) {
  const ok = analyses.filter(a => a && a.ok);
  const objFreq = {}; const missFreq = {};
  for (const a of ok) {
    for (const o of a.objections) objFreq[o.id] = (objFreq[o.id] || 0) + 1;
    for (const m of a.stages.missing) missFreq[m] = (missFreq[m] || 0) + 1;
  }
  const avg = (f) => ok.length ? round(ok.reduce((s, a) => s + f(a), 0) / ok.length) : 0;
  return {
    calls: ok.length,
    avgScore: avg(a => a.score), avgTalkRatio: avg(a => a.talkRatio), avgQuestions: avg(a => a.myQuestions),
    topObjections: Object.entries(objFreq).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    weakStages: Object.entries(missFreq).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
  };
}
