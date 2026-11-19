// A/B (и A/B/n) тесты заходов и офферов. Байесовская оценка: Beta(1+успехи, 1+неудачи),
// вероятность «вариант лучший» — Монте-Карло. Автовыбор победителя: P(best) ≥ 95% и ≥ 30 касаний на вариант.
import { round } from './util.js';

// Детерминированный ГПСЧ, чтобы результаты были стабильны между перерисовками.
function rng(seed = 42) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function gaussian(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Marsaglia–Tsang для Gamma(k, 1)
function gamma(k, r) {
  if (k < 1) return gamma(1 + k, r) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = gaussian(r); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = r();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function beta(a, b, r) { const x = gamma(a, r), y = gamma(b, r); return x / (x + y); }

/** variants: [{id, n, k}] — n касаний, k успехов (ответ/встреча). */
export function evaluate(variants, { draws = 4000, minN = 30, threshold = 0.95, seed = 7 } = {}) {
  const r = rng(seed);
  const wins = Object.fromEntries(variants.map(v => [v.id, 0]));
  if (variants.length) {
    for (let i = 0; i < draws; i++) {
      let best = null, bestVal = -1;
      for (const v of variants) { const s = beta(1 + (v.k || 0), 1 + Math.max(0, (v.n || 0) - (v.k || 0)), r); if (s > bestVal) { bestVal = s; best = v.id; } }
      wins[best]++;
    }
  }
  const rows = variants.map(v => ({
    id: v.id, n: v.n || 0, k: v.k || 0,
    rate: v.n ? round((v.k / v.n) * 100, 1) : 0,
    pBest: round((wins[v.id] / draws) * 100, 1),
    ci: wilson(v.k || 0, v.n || 0),
  }));
  const leader = rows.slice().sort((a, b) => b.pBest - a.pBest)[0];
  const enough = rows.every(x => x.n >= minN);
  const winner = leader && enough && leader.pBest >= threshold * 100 ? leader.id : null;
  const need = rows.length ? Math.max(0, ...rows.map(x => minN - x.n)) : 0;
  return { rows, leader: leader?.id || null, winner, enoughData: enough, moreTouchesNeeded: need };
}

/** 95% доверительный интервал Уилсона, в процентах. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, den = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / den, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / den;
  return [round(Math.max(0, c - h) * 100, 1), round(Math.min(1, c + h) * 100, 1)];
}

/** Thompson sampling: какой вариант отправить следующему лиду (эксплуатация + исследование). */
export function nextVariant(variants, seed = Date.now()) {
  const r = rng(seed);
  let best = null, bestVal = -1;
  for (const v of variants) { const s = beta(1 + (v.k || 0), 1 + Math.max(0, (v.n || 0) - (v.k || 0)), r); if (s > bestVal) { bestVal = s; best = v.id; } }
  return best;
}
