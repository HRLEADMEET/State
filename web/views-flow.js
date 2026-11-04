// Конвейер касаний (телефон), «Что даст 100», мастер запуска, плейбук HH в карточке лида, CRM-файл.
import { S, call, act, go, leadHash, refreshBoot } from './state.js';
import { esc, icon, money, toast, modal, hint, copy, fmtDate, formData, $, $$ } from './ui.js';

const CH = { email: 'Email', telegram: 'Telegram', whatsapp: 'WhatsApp', zalo: 'Zalo', hh_chat: 'чат hh.ru', hh_apply: 'отклик hh.ru' };

function openLink(url) {
  if (!url) return;
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
}

// ====================== КОНВЕЙЕР ======================
export async function viewQueue(el) {
  let data = await call('GET', '/queue');
  let i = 0; let phase = 'ready'; // ready → opened (ждём «отправлено») → captcha
  const draw = () => {
    const items = data.items;
    const caps = data.caps;
    const capChips = Object.entries(caps).filter(([, c]) => c.cap != null).map(([k, c]) => `<span class="tag ${c.left === 0 ? 'bad' : c.left < 5 ? 'warn' : ''}">${esc(CH[k] || k)}: ${c.used}/${c.cap}</span>`).join(' ');
    const it = items[i];
    el.innerHTML = `
      <div class="page-head"><div><h1>Конвейер</h1><p>Готовые касания по одному: скопировать → открыть чат → отправить. Отправка идёт с вашего аккаунта, капчу решаете вы, ваш вклад — одно нажатие. Дневные лимиты защищают аккаунты от блокировки.</p></div>
        <div class="row"><button class="btn" id="q-prepare" data-tour="q-prepare">${icon('spark')}Подготовить ещё 20</button></div></div>
      <div class="row" data-tour="q-caps">${capChips} ${hint('Лимиты в день: Telegram 25 новых диалогов, WhatsApp 20, отклики hh 60. Новый аккаунт и спешка — главные причины блокировок. Меняются в Настройках.')}</div>
      ${!it ? `<div class="card empty" data-tour="q-card"><h3>Конвейер пуст</h3><p>Нажмите «Подготовить ещё 20»: система возьмёт лучших собственников, исследует их и напишет черновики. Или включите автопилот: тогда каждое утро конвейер будет заполнен сам.</p><div class="row" style="justify-content:center"><button class="btn primary" id="q-prepare2">Подготовить касания</button><a class="btn" href="#launch">Мастер запуска</a></div></div>` : `
      <div class="card" style="max-width:720px" data-tour="q-card">
        <div class="row between"><span class="label">${i + 1} из ${items.length}</span><span class="tag brand">${esc(CH[it.channel] || it.channel)}${it.followUp ? ' · дожим ' + it.followUp : ''}</span></div>
        <div><h2>${esc(it.lead.company)}</h2><p class="small mute">${esc(it.lead.owner || 'ЛПР не найден')}${it.lead.vacancy ? ' · ' + esc(it.lead.vacancy) : ''} · оценка ${it.lead.score ?? '—'}</p></div>
        ${(it.lead.flags || []).filter(f => f.human).map(f => `<div class="demo-band" style="background:var(--warn-soft);color:var(--warn);border-color:transparent">${esc(f.text)}</div>`).join('')}
        ${it.subject ? `<label class="field"><span>Тема</span><input id="q-subj" value="${esc(it.subject)}"></label>` : ''}
        <label class="field"><span>Текст (можно поправить перед отправкой)</span><textarea id="q-body" class="tall">${esc(it.body)}</textarea></label>
        ${phase === 'captcha' ? `<div class="demo-band" style="background:var(--warn-soft);color:var(--warn);border-color:transparent">hh.ru просит капчу. Откройте её, решите и нажмите «Повторить отклик».</div>
          <div class="row"><a class="btn" href="${esc(it.lead.captchaUrl || data.captcha || 'https://hh.ru')}" target="_blank" rel="noopener">Открыть капчу hh.ru</a><button class="btn primary" data-q="apply">Повторить отклик</button><button class="btn ghost" data-q="later">Отложить</button></div>` :
        phase === 'opened' ? `<div class="row"><button class="btn primary" data-q="sent">${icon('check')}Да, отправлено</button><button class="btn" data-q="reopen">Открыть чат ещё раз</button><button class="btn ghost" data-q="later">Не получилось — завтра</button></div>` :
        `<div class="row">
          ${it.channel === 'hh_apply' ? `<button class="btn primary" data-q="apply">${icon('send')}Откликнуться на hh.ru</button>` : it.channel === 'email' ? `<button class="btn primary" data-q="email">${icon('send')}Отправить письмо</button>` : `<button class="btn primary" data-q="open">${icon('send')}Скопировать и открыть ${esc(CH[it.channel] || '')}</button>`}
          <button class="btn" data-q="skip">Пропустить</button><button class="btn ghost" data-q="later">Завтра</button><a class="btn ghost" href="${leadHash(it.lead.id)}">Карточка</a>
        </div>`}
      </div>`}`;
    $('#q-prepare')?.addEventListener('click', prepare); $('#q-prepare2')?.addEventListener('click', prepare);
    el.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => onAction(b.dataset.q)));
  };
  const next = async () => { data = await call('GET', '/queue'); phase = 'ready'; if (i >= data.items.length) i = 0; draw(); };
  const prepare = async () => { const r = await act(() => call('POST', '/queue/prepare', { limit: 20 })); if (r) { toast(`Готово касаний: ${r.created}, дожимов: ${r.followUps}${r.errors.length ? '. Ошибки: ' + r.errors.slice(0, 2).join('; ') : ''}`, r.errors.length && !r.created ? 'bad' : ''); next(); } };
  async function onAction(a) {
    const it = data.items[i];
    const body = $('#q-body')?.value;
    if (a === 'open' || a === 'reopen') { await copy(body); openLink(it.link); phase = 'opened'; return draw(); }
    if (a === 'skip' || a === 'later') { await act(() => call('POST', `/queue/${it.id}/act`, { action: a })); return next(); }
    if (a === 'sent' || a === 'email') { const r = await act(() => call('POST', `/queue/${it.id}/act`, { action: 'sent', body })); if (r) { toast(r.queued ? r.note : 'Отмечено. Следующее касание.'); next(); } return; }
    if (a === 'apply') {
      const r = await act(() => call('POST', `/queue/${it.id}/act`, { action: 'apply', body }));
      if (!r) return;
      if (r.captcha) { data.captcha = r.captcha; it.lead.captchaUrl = r.captcha; phase = 'captcha'; toast(r.note); return draw(); }
      toast('Отклик отправлен.'); next();
    }
  }
  draw();
}

// ====================== ЧТО ДАСТ 100 ======================
export async function viewForecast(el) {
  el.innerHTML = `<div class="page-head"><div><h1>Что даст 100</h1><p>Прогноз в цифрах и простыми словами для собственника. Каждое число помечено: факт из кейса, норматив скрипта или допущение. После первых 100 касаний подставьте свои цифры в «Аналитике».</p></div></div>
    <form class="card" id="fc" data-tour="fc-form"><div class="form-grid">
      <label class="field"><span>Сколько</span><input type="number" id="fc-n" name="n" value="100"></label>
      <label class="field"><span>Чего</span><select id="fc-unit" name="unit"><option value="leads">целевых собственников</option><option value="responses">откликов на hh.ru</option></select></label>
      <label class="field"><span>Средний чек, ₽ (пусто — по сценариям)</span><input type="number" id="fc-check" name="checkRub" placeholder="250000"></label>
      <label class="field"><span>Допродажа, ₽</span><input type="number" id="fc-up" name="upsellRub" value="0"></label>
      <label class="field"><span>Ниша (для текста)</span><input id="fc-niche" name="niche" value="IT и онлайн-сервисах"></label>
    </div></form>
    <div id="fc-out"></div>`;
  const run = async () => {
    const r = await call('POST', '/forecast', formData($('#fc'))).catch(e => ({ error: e.message }));
    if (r.error) return void ($('#fc-out').innerHTML = `<p class="mute">${esc(r.error)}</p>`);
    $('#fc-out').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Сценарий</th><th class="n">Целевых</th><th class="n">Встреч назначено</th><th class="n">Проведено</th><th class="n">Встреча → продажа</th><th class="n">Сделок</th><th class="n">Чек</th><th class="n">Выручка</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="n">${x.leads}</td><td class="n">${x.booked}</td><td class="n">${x.held}</td><td class="n">${x.closePct}%</td><td class="n">${x.deals}</td><td class="n">${money(x.checkRub, { usd: false })}</td><td class="n"><b>${money(x.revenueRub)}</b></td></tr>`).join('')}</tbody></table></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h3>Текст для собственника</h3><button class="btn sm" id="fc-copy">${icon('copy')}Копировать</button></div><div class="msg">${esc(r.text)}</div></div>
        <div class="card"><h3>Откуда цифры</h3><div class="list">${Object.values(r.benchmarks).map(b => `<div class="item"><span class="tag ${b.kind === 'факт' ? 'ok' : b.kind === 'норматив' ? 'brand' : 'warn'}">${esc(b.kind)}</span><div class="body small">${esc(b.src)}</div><b class="small num">${b.v < 1 ? (Math.round(b.v * 1000) / 10).toLocaleString('ru-RU') + '%' : Number(b.v).toLocaleString('ru-RU')}</b></div>`).join('')}</div></div>
      </div>`;
    $('#fc-copy').addEventListener('click', () => copy(r.text));
  };
  $('#fc').addEventListener('input', run); run();
}

// ====================== МАСТЕР ЗАПУСКА ======================
export async function viewLaunch(el) {
  const s = await call('GET', '/settings');
  const chans = await call('GET', '/channels');
  let step = 0;
  const steps = ['Вы и оффер', 'Ваши кейсы', 'Кого ищем', 'Как вы пишете', 'Запуск'];
  const main = s.offers.find(o => o.id === 'main') || s.offers.find(o => o.priceRub >= 100000) || s.offers[0];
  const proofs = Array.isArray(s.proofs) ? s.proofs : [];
  const draw = () => {
    el.innerHTML = `<div class="page-head"><div><h1>Мастер запуска</h1><p>Пять шагов, и система начнёт приводить собственников. Подходит и для вас, и для кабинета клиента: каждый вводит свой оффер, кейсы и стиль.</p></div></div>
      <div class="chips" data-tour="launch-steps">${steps.map((t, k) => `<button class="chip ${k === step ? 'on' : ''}" data-step="${k}">${k + 1}. ${esc(t)}</button>`).join('')}</div>
      <form class="card" id="lw" style="max-width:820px">${[
        `<h3>Кто вы и что продаёте</h3><div class="form-grid">
          <label class="field"><span>Ваше имя</span><input id="lw-name" name="name" value="${esc(s.me.name)}"></label>
          <label class="field"><span>Позиционирование</span><input id="lw-title" name="title" value="${esc(s.me.title)}"></label>
          <label class="field"><span>Telegram</span><input id="lw-tg" name="telegram" value="${esc(s.me.telegram)}"></label>
          <label class="field"><span>Главный оффер</span><input id="lw-offer" name="offerName" value="${esc(main?.name || '')}"></label>
          <label class="field"><span>Цена, ₽</span><input id="lw-price" name="offerPrice" type="number" value="${main?.priceRub || 250000}"></label></div>
          <label class="field"><span>Что получает клиент (1–2 фразы, измеримо)</span><textarea id="lw-desc" name="offerDesc" rows="2">${esc(main?.desc || '')}</textarea></label>`,
        `<h3>Ваши кейсы с цифрами ${hint('Письма и скрипты ссылаются только на эти факты. Нет кейсов — система не будет называть цифры результатов, чтобы не выдумывать.')}</h3>
          ${[0, 1, 2].map(k => `<div class="form-grid"><label class="field" style="grid-column:span 2"><span>Кейс ${k + 1}: что сделали и какой результат</span><input id="lw-p${k}" name="p${k}" value="${esc(proofs[k]?.text || '')}" placeholder="за 3 месяца с нуля: 84 договора и 7,67 млн ₽ выручки"></label><label class="field"><span>Ссылка на кейс</span><input id="lw-pu${k}" name="pu${k}" value="${esc(proofs[k]?.url || '')}" placeholder="https://t.me/..."></label></div>`).join('')}
          ${!proofs.length && S.boot.ws.kind !== 'client' ? '<p class="xs mute">Пусто — используются кейсы LEADMEET из каталога.</p>' : ''}`,
        `<h3>Кого ищем на hh.ru</h3><div class="form-grid">
          <label class="field" style="grid-column:1/-1"><span>Должности (по строке)</span><textarea id="lw-roles" name="roles" rows="3">${esc(s.hh.roles.join('\n'))}</textarea></label>
          <label class="field"><span>Регион (ID hh)</span><input id="lw-area" name="area" value="${esc(s.hh.area)}"></label>
          <label class="field"><span>Зарплата от, ₽</span><input id="lw-sal" name="salaryFrom" type="number" value="${s.hh.salaryFrom}"></label>
          <label class="field"><span>Ниши ядра (через запятую)</span><input id="lw-core" name="coreKeywords" value="${esc((s.hh.coreKeywords || []).join(', '))}"></label>
          <label class="field"><span>Стоп-ниши</span><input id="lw-stop" name="stopNiches" value="${esc((s.hh.stopNiches || []).join(', '))}"></label>
          <label class="field"><span>Конкуренты (не откликаемся)</span><input id="lw-comp" name="competitors" value="${esc((s.hh.competitors || []).join(', '))}"></label></div>`,
        `<h3>Как вы пишете</h3><label class="field"><span>3–5 ваших сообщений клиентам</span><textarea id="lw-sample" name="mySample" class="tall">${esc(s.me.mySample || '')}</textarea></label>
          <div class="form-grid"><label class="field"><span>Ваш часовой пояс</span><input id="lw-tz" name="tzMine" value="${esc(s.tz?.mine || 'Asia/Ho_Chi_Minh')}"></label><label class="field"><span>Часовой пояс клиентов</span><input id="lw-tzc" name="tzClients" value="${esc(s.tz?.clients || 'Europe/Moscow')}"></label></div>`,
        `<h3>Подключения и запуск</h3><div class="list">${['hh', 'telegram_bot', 'email', 'telegram_personal', 'llm', 'dadata'].map(t => { const c = chans.find(x => x.type === t); return `<div class="item"><span class="ico ${c?.enabled ? 'ok' : 'warn'}">${icon(c?.enabled ? 'check' : 'plug')}</span><div class="body"><div class="title">${esc(c?.name || t)}</div><div class="small mute">${c?.enabled ? 'подключено' : 'не подключено — можно позже'}</div></div><a class="btn sm" href="#channels">Настроить</a></div>`; }).join('')}</div>
          <label class="switch"><input type="checkbox" id="lw-ap" name="autopilot" ${s.autopilot?.enabled ? 'checked' : ''}> Автопилот: каждое утро готовить касания, вечером — разбор и отчёт в Telegram</label>`,
      ][step]}
      <div class="row between"><button class="btn" type="button" id="lw-back" ${step ? '' : 'disabled'}>Назад</button><button class="btn primary" type="submit">${step === steps.length - 1 ? 'Сохранить и подготовить первые касания' : 'Сохранить и дальше'}</button></div></form>`;
    el.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { step = +b.dataset.step; draw(); }));
    $('#lw-back').addEventListener('click', () => { step = Math.max(0, step - 1); draw(); });
    $('#lw').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = formData(e.target);
      const patch = [
        () => ({ me: { name: f.name, title: f.title, telegram: f.telegram }, offers: [{ id: 'main', name: f.offerName || 'Основной оффер', priceRub: Number(f.offerPrice) || 0, kind: 'service', desc: f.offerDesc || '' }, ...s.offers.filter(o => o.id !== 'main')] }),
        () => ({ proofs: [0, 1, 2].map(k => ({ id: 'my' + k, isCase: true, short: String(f['p' + k] || '').slice(0, 60), text: f['p' + k], url: f['pu' + k], niche: ['all'] })).filter(p => p.text && p.text.trim()) }),
        () => ({ hh: { roles: f.roles.split('\n').map(x => x.trim()).filter(Boolean), area: f.area, salaryFrom: Number(f.salaryFrom) || 0, coreKeywords: split(f.coreKeywords), stopNiches: split(f.stopNiches), competitors: split(f.competitors) } }),
        () => ({ me: { mySample: f.mySample }, tz: { mine: f.tzMine, clients: f.tzClients } }),
        () => ({ autopilot: { enabled: !!f.autopilot }, launchDone: true }),
      ][step]();
      if (step === 1 && !patch.proofs.length && S.boot.ws.kind !== 'client') delete patch.proofs;
      const ok = await act(() => call('PUT', '/settings', patch));
      if (!ok) return;
      Object.assign(s, ok);
      if (step < steps.length - 1) { step++; toast('Сохранено'); return draw(); }
      await refreshBoot();
      const r = await act(() => call('POST', '/queue/prepare', { limit: 20 }));
      toast(r ? `Готово касаний: ${r.created}. Открываю конвейер.` : 'Сохранено');
      go('#queue');
    });
  };
  draw();
}
const split = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

// ====================== ПЛЕЙБУК HH В КАРТОЧКЕ ЛИДА ======================
export async function playbookCard(lead, box) {
  const pb = await call('GET', `/leads/${lead.id}/playbook`);
  const step = (s) => `<div class="stage"><div class="row between"><b>${esc(s.title)}</b><span class="xs mute">${esc(s.when)}</span></div><p class="small" style="white-space:pre-wrap">${esc(s.text)}</p>${s.note ? `<p class="xs mute">${esc(s.note)}</p>` : ''}<div><button class="btn sm" data-copy-text="${esc(s.text)}">${icon('copy')}Копировать</button></div></div>`;
  box.innerHTML = `<div class="card" data-tour="playbook"><div class="card-head"><h3>HH-переписка: метод партизан</h3>${hint('На hh.ru пишем только как кандидат: вопросы про объём лидов и команду, без слов «система», «кейсы», «аудит» и без ссылок, иначе блокируют аккаунт. Предложение и аудит — после перехода в Telegram или WhatsApp.')}</div>
    ${pb.flags.map(f => `<div class="demo-band" style="background:${f.human ? 'var(--warn-soft)' : 'var(--brand-soft)'};color:${f.human ? 'var(--warn)' : 'var(--brand-ink)'};border-color:transparent">${esc(f.text)}</div>`).join('')}
    <label class="field"><span>Отклик на вакансию (честный формат)</span><textarea id="pb-letter" rows="7">${esc(pb.letter.text)}</textarea></label>
    <ul class="issues">${pb.letter.issues.map(i => `<li class="error">${esc(i.msg)}</li>`).join('') || '<li>Безопасно для hh.ru: нет слов-триггеров и ссылок.</li>'}</ul>
    <div class="row"><button class="btn primary sm" id="pb-copy-open">${icon('send')}Скопировать и открыть вакансию</button>${S.api.mode === 'server' || S.boot.demo ? '<button class="btn sm" id="pb-apply">Откликнуться через API hh</button>' : ''}</div>
    <details><summary>Шаги переписки на hh.ru (как кандидат)</summary><div class="stack" style="margin-top:8px">${pb.steps.filter(s => s.channel === 'hh').map(step).join('')}</div></details>
    <details><summary>После перехода в Telegram / WhatsApp</summary><div class="stack" style="margin-top:8px">${pb.steps.filter(s => s.channel === 'messenger').map(step).join('')}</div></details>
    <div><span class="label">Слоты для встречи (мск и ваше время)</span><div class="chips" style="margin-top:6px">${pb.slots.map(sl => `<span class="tag" title="${esc(sl.mine)}">${esc(sl.label)} · ${esc(sl.mine)}</span>`).join('')}</div></div>
    <details><summary>Дожим после встречи: 4 касания</summary><div class="stack" style="margin-top:8px">${pb.cadence.map(c => step({ title: c.when, when: '', text: c.text, note: c.note })).join('')}</div></details>
    <details><summary>Фиксация встречи (в CRM или чат)</summary><div class="code">${esc(pb.record)}</div><button class="btn sm" data-copy-text="${esc(pb.record)}">${icon('copy')}Копировать</button></details>
  </div>`;
  box.querySelectorAll('[data-copy-text]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copyText)));
  $('#pb-copy-open').addEventListener('click', async () => { await copy($('#pb-letter').value); openLink(lead.vacancy?.url || 'https://hh.ru'); });
  $('#pb-apply')?.addEventListener('click', async () => {
    const msg = await act(() => call('POST', `/leads/${lead.id}/messages`, { channel: 'hh_apply', body: $('#pb-letter').value, hook: 'hh_letter', status: 'approved' }));
    if (!msg) return;
    const r = await act(() => call('POST', `/queue/${msg.id}/act`, { action: 'apply' }));
    if (r?.captcha) { modal(`<h3>hh.ru просит капчу</h3><p>Откройте ссылку, решите капчу и затем нажмите «Повторить отклик» в Конвейере.</p><div class="row"><a class="btn primary" href="${esc(r.captcha)}" target="_blank" rel="noopener">Открыть капчу</a><a class="btn" href="#queue" data-close>В конвейер</a></div>`); }
    else if (r?.applied) { toast('Отклик отправлен через API hh.ru'); S.render(); }
  });
}

// ====================== CRM-ФАЙЛ АГЕНТА ======================
export function crmCard() {
  return `<div class="card" data-tour="crm"><div class="card-head"><h3>CRM-файл агента (CSV)</h3>${hint('Тот же формат, что LEADMEET_CRM_лиды_HH.csv: дата сигнала, компания, ниша, источник, контакт, роль, ссылка, ЗП, статус, следующий шаг, кто, комментарий. Агент на компьютере и приложение работают с одной таблицей.')}</div>
    <p class="small mute">Загрузите файл, который ведёт ваш агент на hh.ru: статусы станут этапами воронки, скоринг — оценкой, номера чатов — ссылками. Выгрузка — обратно в тот же формат.</p>
    <div class="row"><input type="file" id="crm-file" accept=".csv,text/csv" style="max-width:280px"><button class="btn" id="crm-import">Импортировать</button><button class="btn" id="crm-export">Выгрузить CSV</button></div></div>`;
}
export function bindCrm(root) {
  root.querySelector('#crm-import')?.addEventListener('click', async () => {
    const f = root.querySelector('#crm-file').files[0];
    if (!f) return toast('Выберите CSV-файл', 'bad');
    const csv = await f.text();
    const r = await act(() => call('POST', '/crm/import', { csv }));
    if (r) toast(`Импортировано: ${r.created}, пропущено дублей: ${r.skipped}`);
  });
  root.querySelector('#crm-export')?.addEventListener('click', async () => {
    const r = await act(() => call('GET', '/crm/export'));
    if (!r) return;
    if (S.api.download) {
      S.api.download(r.filename, r.csv);
    } else modal(`<h3>${esc(r.filename)}</h3><p class="small mute">Скопируйте содержимое и сохраните как .csv.</p><textarea class="tall mono" readonly>${esc(r.csv)}</textarea><div class="row"><button class="btn" id="crm-cp">${icon('copy')}Скопировать</button><button class="btn" data-close>Закрыть</button></div>`, { onMount(m) { m.querySelector('#crm-cp').addEventListener('click', () => copy(r.csv)); } });
  });
}

// ====================== АВТОПИЛОТ (карточка на пульте) ======================
export async function autopilotCard() {
  const s = S.boot.settings; const ap = s.autopilot || {};
  const runs = await call('GET', '/autopilot/runs').catch(() => []);
  const last = runs[0];
  return `<div class="card" data-tour="autopilot"><div class="card-head"><h3>Автопилот ${ap.enabled ? '<span class="tag ok">включён</span>' : '<span class="tag">выключен</span>'}</h3>${hint('Утром: свежие вакансии hh → импорт → исследование → готовые касания в конвейер. Вечером: правило «нет ответа 3 дня = отказ», ответы с hh, отчёт. Итог приходит в Telegram-бот.')}</div>
    <p class="small mute">Утро ${String(ap.morningHour ?? 8).padStart(2, '0')}:00 и вечер ${ap.eveningHour ?? 20}:00 по вашему времени (${esc(s.tz?.mine || '')}).</p>
    ${last ? `<div class="msg">${esc(last.summary)}</div><p class="xs mute">${fmtDate(last.at)}</p>` : '<p class="small mute">Запусков ещё не было.</p>'}
    <div class="row"><button class="btn sm" data-ap="morning">Утренний запуск сейчас</button><button class="btn sm" data-ap="evening">Вечерний разбор</button><a class="btn sm primary" href="#queue">Открыть конвейер</a></div></div>`;
}
export function bindAutopilot(root) {
  root.querySelectorAll('[data-ap]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await act(() => call('POST', '/autopilot/run', { phase: b.dataset.ap }));
    b.disabled = false;
    if (r) { toast(r.summary.split('\n')[0]); S.render(); }
  }));
}
