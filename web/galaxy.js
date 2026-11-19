// Живой фон экрана входа: «галактика связей». Точки — компании, голубые — сигналы (вакансия открыта),
// золотые — собственники. Импульс бежит по связям от сигнала к собственнику — это и есть продукт.
// Реагирует на мышь, касание и наклон телефона. Без библиотек, один canvas, пауза в фоне.

const WORDS = ['ищут РОПа', 'сигнал', 'собственник', 'ответил', 'встреча', 'сделка', '200 000 ₽', 'его стиль', 'факт', 'hh.ru', 'Telegram', 'ЕГРЮЛ', 'owner', 'meeting', '会议', 'cuộc họp', 'кездесу'];
const LABELS = ['ответил', 'встреча в четверг', 'сделка 250 000 ₽', 'пишет сам', 'аудит назначен', '«давайте созвонимся»'];

export function startGalaxy(canvas, { onParallax } = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, nodes = [], words = [], pulses = [], rings = [], labels = [];
  const ptr = { x: -9999, y: -9999, on: false, tx: 0, ty: 0 };   // tx/ty — смещение параллакса −1..1
  const tilt = { x: 0, y: 0, on: false };
  let par = { x: 0, y: 0 }, raf = 0, last = performance.now(), nextPulse = 0, alive = true;

  const rnd = (a, b) => a + Math.random() * (b - a);
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(170, Math.max(55, (W * H) / 8500)));
    nodes = Array.from({ length: n }, (_, i) => {
      const t = Math.random(); const type = t < 0.06 ? 'owner' : t < 0.15 ? 'signal' : 'star';
      return { x: rnd(0, W), y: rnd(0, H), vx: rnd(-.12, .12), vy: rnd(-.12, .12), z: rnd(.35, 1), r: type === 'owner' ? rnd(2.2, 3.2) : type === 'signal' ? rnd(1.8, 2.4) : rnd(.6, 1.6), type, flash: 0, ph: rnd(0, 6.28) };
    });
    words = WORDS.map(w => ({ w, x: rnd(0, W), y: rnd(0, H), z: rnd(.3, .8), vx: rnd(-.08, .08), vy: rnd(-.05, .05), a: rnd(.05, .14) }));
  }

  // ---------- ввод: мышь, касание, наклон ----------
  const move = (x, y) => { ptr.x = x; ptr.y = y; ptr.on = true; if (!tilt.on) { ptr.tx = (x / W) * 2 - 1; ptr.ty = (y / H) * 2 - 1; } };
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); move(e.clientX - r.left, e.clientY - r.top); };
  const onLeave = () => { ptr.on = false; };
  const onDown = (e) => {
    if (e.target.closest?.('form, button, input, a, label, .tips, .faq')) return;
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    move(x, y); rings.push({ x, y, t: 0 });
    // касание «рождает» сигнал: ближайший узел становится голубым и запускает импульс
    const near = nodes.reduce((b, n) => { const d = (n.x - x) ** 2 + (n.y - y) ** 2; return d < b.d ? { n, d } : b; }, { n: null, d: Infinity }).n;
    if (near) { near.type = near.type === 'owner' ? 'owner' : 'signal'; launch(near); }
    askTilt();
  };
  const onTilt = (e) => {
    if (e.gamma == null) return;
    tilt.on = true; tilt.x = Math.max(-1, Math.min(1, e.gamma / 30)); tilt.y = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
    ptr.tx = tilt.x; ptr.ty = tilt.y;
  };
  let tiltAsked = false;
  function askTilt() { // iOS просит разрешение на датчик только по жесту пользователя
    if (tiltAsked) return; tiltAsked = true;
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onTilt); }).catch(() => {});
  }
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') addEventListener('deviceorientation', onTilt);
  const host = canvas.parentElement || canvas; // слушаем всю страницу входа, а не только свободный фон
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointerleave', onLeave);
  addEventListener('resize', resize);
  const onVis = () => { if (!document.hidden && alive) { last = performance.now(); loop(last); } else cancelAnimationFrame(raf); };
  document.addEventListener('visibilitychange', onVis);

  // ---------- импульс: от сигнала через 2–5 узлов к ближайшему собственнику ----------
  function launch(from) {
    const owners = nodes.filter(n => n.type === 'owner' && n !== from);
    if (!owners.length) return;
    const target = owners.reduce((b, n) => (Math.hypot(n.x - from.x, n.y - from.y) < Math.hypot(b.x - from.x, b.y - from.y) ? n : b));
    const path = [from]; let cur = from;
    for (let hop = 0; hop < 5 && cur !== target; hop++) {
      const dT = Math.hypot(target.x - cur.x, target.y - cur.y);
      if (dT < 170) { path.push(target); cur = target; break; }
      const cand = nodes.filter(n => !path.includes(n) && Math.hypot(n.x - cur.x, n.y - cur.y) < 170 && Math.hypot(target.x - n.x, target.y - n.y) < dT);
      if (!cand.length) { path.push(target); cur = target; break; }
      cur = cand.reduce((b, n) => (Math.hypot(target.x - n.x, target.y - n.y) < Math.hypot(target.x - b.x, target.y - b.y) ? n : b)); path.push(cur);
    }
    if (path[path.length - 1] !== target) path.push(target);
    pulses.push({ path, seg: 0, t: 0 });
  }

  const px = (n) => n.x + par.x * 26 * n.z, py = (n) => n.y + par.y * 26 * n.z;

  function step(dt) {
    const k = reduce ? 0.15 : 1;
    par.x += (ptr.tx - par.x) * 0.04; par.y += (ptr.ty - par.y) * 0.04;
    onParallax?.(par.x, par.y);
    const cx = W / 2, cy = H / 2;
    for (const n of nodes) {
      // медленный вихрь вокруг центра — «галактика»
      const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) + 60;
      n.vx += (-dy / d) * 0.0025 * k; n.vy += (dx / d) * 0.0025 * k;
      if (ptr.on) { // мягкая гравитация курсора
        const mx = ptr.x - n.x, my = ptr.y - n.y, md = Math.hypot(mx, my);
        if (md < 180 && md > 1) { const f = (1 - md / 180) * 0.02 * k; n.vx += (mx / md) * f; n.vy += (my / md) * f; }
      }
      for (const r of rings) { const rx = n.x - r.x, ry = n.y - r.y, rd = Math.hypot(rx, ry); const front = r.t * 420; if (Math.abs(rd - front) < 30 && rd > 1) { n.vx += (rx / rd) * 0.35; n.vy += (ry / rd) * 0.35; } }
      n.vx *= 0.985; n.vy *= 0.985;
      n.x += n.vx * dt * 0.06 * k; n.y += n.vy * dt * 0.06 * k;
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20; if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
      n.flash = Math.max(0, n.flash - dt / 900); n.ph += dt / 1400;
    }
    for (const w of words) { w.x += w.vx * dt * 0.05; w.y += w.vy * dt * 0.05; if (w.x < -120) w.x = W + 40; if (w.x > W + 120) w.x = -40; if (w.y < -20) w.y = H + 20; if (w.y > H + 20) w.y = -20; }
    rings = rings.filter(r => (r.t += dt / 1000) < 1.2);
    for (const p of pulses) {
      p.t += dt / (reduce ? 1400 : 520);
      if (p.t >= 1) { p.t = 0; p.seg++; if (p.seg >= p.path.length - 1) { const o = p.path[p.path.length - 1]; o.flash = 1; labels.push({ x: o.x, y: o.y, text: LABELS[(Math.random() * LABELS.length) | 0], t: 0, n: o }); p.done = true; } }
    }
    pulses = pulses.filter(p => !p.done);
    labels = labels.filter(l => (l.t += dt / 2600) < 1);
    if ((nextPulse -= dt) <= 0) { nextPulse = reduce ? 6000 : rnd(1600, 3200); const s = nodes.filter(n => n.type === 'signal'); if (s.length && pulses.length < 4) launch(s[(Math.random() * s.length) | 0]); }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // туманность
    const g = ctx.createRadialGradient(W * (.5 + par.x * .05), H * (.45 + par.y * .05), 0, W / 2, H / 2, Math.max(W, H) * .7);
    g.addColorStop(0, 'rgba(45,140,255,.16)'); g.addColorStop(.5, 'rgba(90,60,200,.06)'); g.addColorStop(1, 'rgba(4,10,24,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // слова-созвездия на дальнем плане
    ctx.font = '600 12px Manrope, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const w of words) { ctx.fillStyle = `rgba(170,200,255,${w.a})`; ctx.fillText(w.w, w.x + par.x * 40 * w.z, w.y + par.y * 40 * w.z); }
    // связи: сетка-корзины, чтобы не считать все пары
    const D = Math.min(150, Math.max(95, W / 9)), cell = D, grid = new Map();
    for (const n of nodes) { const key = ((px(n) / cell) | 0) + ',' + ((py(n) / cell) | 0); (grid.get(key) || grid.set(key, []).get(key)).push(n); }
    ctx.lineWidth = 1;
    for (const n of nodes) {
      const gx = (px(n) / cell) | 0, gy = (py(n) / cell) | 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const m of grid.get((gx + i) + ',' + (gy + j)) || []) {
          if (m === n || m.x < n.x) continue;
          const d = Math.hypot(px(n) - px(m), py(n) - py(m));
          if (d < D) { const a = (1 - d / D) * 0.28 * Math.min(n.z, m.z); ctx.strokeStyle = `rgba(110,170,255,${a})`; ctx.beginPath(); ctx.moveTo(px(n), py(n)); ctx.lineTo(px(m), py(m)); ctx.stroke(); }
        }
      }
    }
    // нити к курсору
    if (ptr.on) for (const n of nodes) { const d = Math.hypot(px(n) - ptr.x, py(n) - ptr.y); if (d < 160) { ctx.strokeStyle = `rgba(140,200,255,${(1 - d / 160) * .5})`; ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(px(n), py(n)); ctx.stroke(); } }
    // узлы
    for (const n of nodes) {
      const tw = .65 + .35 * Math.sin(n.ph * 3);
      const col = n.type === 'owner' ? `rgba(255,205,110,${.75 + n.flash * .25})` : n.type === 'signal' ? `rgba(90,220,255,${.8 * tw + .2})` : `rgba(210,225,255,${.35 + .45 * n.z * tw})`;
      if (n.type !== 'star' || n.flash) { ctx.fillStyle = n.type === 'owner' ? `rgba(255,190,80,${.10 + n.flash * .35})` : 'rgba(90,220,255,.10)'; ctx.beginPath(); ctx.arc(px(n), py(n), n.r * (4 + n.flash * 6), 0, 6.283); ctx.fill(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(n), py(n), n.r * (n.z * .6 + .5), 0, 6.283); ctx.fill();
    }
    // импульсы по пути сигнал → собственник
    for (const p of pulses) {
      for (let s = 0; s <= p.seg && s < p.path.length - 1; s++) {
        const a = p.path[s], b = p.path[s + 1], t = s < p.seg ? 1 : p.t;
        ctx.strokeStyle = 'rgba(120,230,255,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(px(a), py(a)); ctx.lineTo(px(a) + (px(b) - px(a)) * t, py(a) + (py(b) - py(a)) * t); ctx.stroke();
      }
      const a = p.path[p.seg], b = p.path[p.seg + 1];
      if (a && b) { const x = px(a) + (px(b) - px(a)) * p.t, y = py(a) + (py(b) - py(a)) * p.t; ctx.fillStyle = 'rgba(200,245,255,.95)'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(120,230,255,.18)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.283); ctx.fill(); }
      ctx.lineWidth = 1;
    }
    for (const r of rings) { ctx.strokeStyle = `rgba(140,200,255,${(1 - r.t / 1.2) * .5})`; ctx.beginPath(); ctx.arc(r.x, r.y, r.t * 420, 0, 6.283); ctx.stroke(); }
    ctx.font = '700 12px Manrope, system-ui, sans-serif';
    for (const l of labels) { const a = l.t < .15 ? l.t / .15 : 1 - (l.t - .15) / .85; ctx.fillStyle = `rgba(255,215,140,${a})`; ctx.fillText(l.text, px(l.n), py(l.n) - 14 - l.t * 22); }
  }

  function loop(now) {
    if (!canvas.isConnected) { stop(); return; }
    const dt = Math.min(50, now - last); last = now;
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    alive = false; cancelAnimationFrame(raf);
    removeEventListener('resize', resize); removeEventListener('deviceorientation', onTilt); document.removeEventListener('visibilitychange', onVis);
  }
  resize(); draw(); raf = requestAnimationFrame(loop);
  return { stop };
}

/** Подсказки как на экране загрузки игры: сменяются сами, по клику — следующая. */
export function startTips(el, tips) {
  let i = Math.floor(Math.random() * tips.length), timer = 0;
  const DUR = 7000;
  el.innerHTML = '<div class="tip-head"><span class="label">Совет</span><span class="tip-count"></span></div><p class="tip-text" aria-live="polite"></p><div class="tip-bar"><i></i></div>';
  const text = el.querySelector('.tip-text'), bar = el.querySelector('.tip-bar i'), count = el.querySelector('.tip-count');
  function show(n) {
    i = (n + tips.length) % tips.length;
    text.classList.remove('in'); void text.offsetWidth;
    text.textContent = tips[i]; text.classList.add('in');
    count.textContent = `${i + 1} / ${tips.length}`;
    bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth;
    bar.style.transition = `width ${DUR}ms linear`; bar.style.width = '100%';
    clearTimeout(timer); timer = setTimeout(() => { if (el.isConnected) show(i + 1); }, DUR);
  }
  el.addEventListener('click', () => show(i + 1));
  el.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'Enter') show(i + 1); if (e.key === 'ArrowLeft') show(i - 1); });
  show(i);
}

/** Площадки на экране входа: подсветка по наведению/касанию и автопрокрутка с подписью «что даёт». */
export function startPlatforms(box) {
  if (!box) return;
  const ul = box.querySelector('ul'), cap = box.querySelector('.stack-cap'), bs = [...box.querySelectorAll('.pf')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let k = -1, paused = false, pauseT = 0;
  const show = (b, user) => {
    bs.forEach(x => x !== b && x.classList.remove('on')); b.classList.add('on'); ul.classList.add('lit');
    cap.classList.add('fade');
    setTimeout(() => { const n = document.createElement('b'); n.textContent = b.lastChild.textContent.trim() + ': '; const t = b.dataset.d; cap.replaceChildren(n, document.createTextNode(t.charAt(0).toLowerCase() + t.slice(1))); cap.classList.remove('fade'); }, reduce ? 0 : 180);
    if (user) { paused = true; clearTimeout(pauseT); pauseT = setTimeout(() => { paused = false; }, 6000); }
  };
  for (const ev of ['mouseover', 'focusin', 'click']) box.addEventListener(ev, (e) => { const b = e.target.closest('.pf'); if (b) show(b, true); });
  if (reduce) return;
  const iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); if (paused || document.hidden) return; k = (k + 1) % bs.length; show(bs[k], false); }, 2600);
}
