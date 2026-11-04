// Профиль стиля: как пишет человек (собственник — в своих постах, ты — в своих сообщениях).
// Используется, чтобы письмо звучало «на его языке», а не как рассылка.
import { words, sentences, round } from './util.js';

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const STOP = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между это наш наши свой свои который которые также очень просто').split(' '));

const SLANG = ['кейс', 'фишк', 'топ', 'чек', 'лид', 'оффер', 'хайп', 'респект', 'имхо', 'го ', 'норм', 'круто', 'огонь', 'кайф', 'бро', 'движ', 'прокач', 'зашло', 'жиза', 'лол'];
const BUSINESS = ['выручк', 'прибыл', 'маржин', 'оборот', 'команд', 'стратег', 'масштаб', 'клиент', 'продаж', 'рост', 'систем', 'процесс', 'результат', 'цифр', 'kpi', 'воронк', 'окупаем'];

export function analyzeStyle(text = '') {
  const raw = String(text || '').trim();
  if (raw.length < 40) return { ok: false, reason: 'Мало текста: вставьте 3–5 постов или сообщений (от 300 знаков).', sample: raw.length };
  const sents = sentences(raw);
  const ws = words(raw);
  const lower = raw.toLowerCase();
  const emojis = raw.match(EMOJI_RE) || [];
  const tyCount = (lower.match(/(^|[^а-яё])(ты|тебя|тебе|твой|твоя|твои|тобой)(?=[^а-яё]|$)/g) || []).length;
  const vyCount = (lower.match(/(^|[^а-яё])(вы|вас|вам|ваш|ваша|ваши|вами)(?=[^а-яё]|$)/g) || []).length;
  const capsVy = (raw.match(/(^|[^А-ЯЁа-яё])(Вы|Вас|Вам|Ваш|Ваша|Ваши)(?=[^А-ЯЁа-яё]|$)/g) || []).length;
  const exclam = (raw.match(/!/g) || []).length;
  const questions = (raw.match(/\?/g) || []).length;
  const ellipsis = (raw.match(/\.\.\.|…/g) || []).length;
  const dashes = (raw.match(/ — | – /g) || []).length;
  const hyphenDash = (raw.match(/ - /g) || []).length;
  const lowerStarts = sents.filter(s => /^[a-zа-яё]/.test(s)).length;
  const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim());
  const avgSentenceWords = sents.length ? round(ws.length / sents.length, 1) : ws.length;
  const avgParagraphSents = paragraphs.length ? round(sents.length / paragraphs.length, 1) : sents.length;
  const bullets = (raw.match(/^\s*([-•—*]|\d+[.)])\s+/gm) || []).length;
  const slangHits = SLANG.filter(s => lower.includes(s));
  const bizHits = BUSINESS.filter(s => lower.includes(s));
  const numbers = (raw.match(/\d[\d\s]*[\d%]/g) || []).length;

  const freq = {};
  for (const w of ws) if (w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w)) freq[w] = (freq[w] || 0) + 1;
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, n]) => ({ w, n }));

  // Устойчивые обороты: повторяющиеся биграммы без стоп-слов на краях.
  const bigrams = {};
  for (let i = 0; i < ws.length - 1; i++) {
    const a = ws[i], b = ws[i + 1];
    if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3) continue;
    const k = a + ' ' + b; bigrams[k] = (bigrams[k] || 0) + 1;
  }
  const phrases = Object.entries(bigrams).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p);

  const sentCount = Math.max(1, sents.length);
  const formality = tyCount > vyCount ? 'ty' : 'vy';
  const energy = exclam / sentCount > 0.25 ? 'high' : exclam / sentCount > 0.08 ? 'medium' : 'calm';
  const length = avgSentenceWords <= 9 ? 'short' : avgSentenceWords <= 16 ? 'medium' : 'long';
  const register = slangHits.length >= 3 ? 'casual' : bizHits.length >= 4 && slangHits.length < 2 ? 'business' : 'neutral';

  return {
    ok: true,
    sampleChars: raw.length,
    formality,                         // 'ty' | 'vy'
    capitalVy: capsVy > 0,             // пишет «Вы» с большой буквы
    emojiPerSentence: round(emojis.length / sentCount, 2),
    topEmojis: [...new Set(emojis)].slice(0, 5),
    energy, length, register,
    avgSentenceWords, avgParagraphSents,
    usesBullets: bullets >= 2,
    usesEllipsis: ellipsis >= 2,
    dash: dashes >= hyphenDash ? '—' : '-',
    lowercaseStarts: lowerStarts / sentCount > 0.4,
    asksQuestions: questions / sentCount > 0.15,
    loveNumbers: numbers / sentCount > 0.3,
    topWords, phrases,
    slang: slangHits, business: bizHits,
    summary: describe({ formality, energy, length, register, emoji: emojis.length / sentCount, numbers: numbers / sentCount, lowerStarts: lowerStarts / sentCount > 0.4 }),
  };
}

function describe(p) {
  const parts = [];
  parts.push(p.formality === 'ty' ? 'на «ты»' : 'на «вы»');
  parts.push({ short: 'короткими фразами', medium: 'фразами средней длины', long: 'длинными развёрнутыми фразами' }[p.length]);
  parts.push({ high: 'эмоционально, с восклицаниями', medium: 'живо', calm: 'спокойно, без восклицаний' }[p.energy]);
  if (p.emoji > 0.3) parts.push('много эмодзи'); else if (p.emoji > 0.05) parts.push('иногда эмодзи'); else parts.push('без эмодзи');
  if (p.register === 'casual') parts.push('разговорный сленг');
  if (p.register === 'business') parts.push('деловая лексика');
  if (p.numbers > 0.3) parts.push('любит цифры');
  if (p.lowerStarts) parts.push('часто с маленькой буквы');
  return 'Пишет ' + parts.join(', ') + '.';
}

/** Подгоняет готовый текст под профиль: обращение, длина фраз, эмодзи, тире. Не выдумывает содержание. */
export function applyStyle(text, profile) {
  if (!profile || !profile.ok) return text;
  let t = String(text);
  if (profile.formality === 'ty') t = toTy(t);
  else if (profile.capitalVy) t = t.replace(/(^|[^А-ЯЁа-яё])(вы|вас|вам|ваш|ваша|ваше|ваши|вами|вашей|вашего|вашу|вашим|ваших)(?=[^а-яё]|$)/g, (m, p, w) => p + w[0].toUpperCase() + w.slice(1));
  if (profile.dash === '-') t = t.replace(/ — /g, ' - ');
  if (profile.energy === 'calm') t = t.replace(/!(?=\s|$)/g, '.');
  if (profile.emojiPerSentence > 0.3 && profile.topEmojis.length) {
    const lines = t.split('\n');
    const i = Math.min(lines.length - 1, 1);
    if (!/\p{Extended_Pictographic}/u.test(lines[i])) lines[i] = lines[i].replace(/([.!?])?$/, (m) => ' ' + profile.topEmojis[0] + (m || ''));
    t = lines.join('\n');
  }
  return t;
}

const TY_MAP = [
  ['вы', 'ты'], ['вас', 'тебя'], ['вам', 'тебе'], ['вами', 'тобой'], ['ваш', 'твой'], ['ваша', 'твоя'], ['ваше', 'твоё'],
  ['ваши', 'твои'], ['вашей', 'твоей'], ['вашего', 'твоего'], ['вашу', 'твою'], ['вашим', 'твоим'], ['ваших', 'твоих'], ['вашем', 'твоём'],
];
// Самые частые глагольные формы в наших шаблонах.
const VERB_MAP = [
  ['ищете', 'ищешь'], ['видите', 'видишь'], ['хотите', 'хочешь'], ['можете', 'можешь'], ['знаете', 'знаешь'], ['думаете', 'думаешь'],
  ['скажете', 'скажешь'], ['решите', 'решишь'], ['получите', 'получишь'], ['посмотрите', 'посмотри'], ['напишите', 'напиши'],
  ['задайте', 'задай'], ['ответьте', 'ответь'], ['созвонимся', 'созвонимся'], ['будете', 'будешь'], ['считаете', 'считаешь'],
  ['планируете', 'планируешь'], ['готовы', 'готов'], ['удобно ли вам', 'удобно ли тебе'], ['подскажите', 'подскажи'], ['проверьте', 'проверь'],
  ['развиваете', 'развиваешь'], ['строите', 'строишь'], ['нанимаете', 'нанимаешь'], ['уходите', 'уходишь'], ['теряете', 'теряешь'],
];

function swapWord(t, from, to) {
  const re = (w) => new RegExp('(?<![А-ЯЁа-яё])' + w + '(?![А-ЯЁа-яё])', 'g');
  const Cap = (w) => w[0].toUpperCase() + w.slice(1);
  return t.replace(re(from), to).replace(re(Cap(from)), Cap(to));
}

function toTy(t) {
  for (const [a, c] of TY_MAP) t = swapWord(t, a, c);
  for (const [a, c] of VERB_MAP) t = swapWord(t, a, c);
  t = t.replace(/Здравствуйте/g, 'Привет').replace(/Добрый день/g, 'Привет');
  return t;
}

const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
export { cap };
