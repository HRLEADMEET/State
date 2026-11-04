// «Тайная библиотека»: FAQ на пяти языках с поиском, разделами и закладками. Открывается мерцающей звездой
// в углу экрана входа, клавишей «?» или тройным нажатием на логотип.
import { esc } from './ui.js';

export const LANGS = [{ id: 'ru', name: 'Русский' }, { id: 'en', name: 'English' }, { id: 'kk', name: 'Қазақша' }, { id: 'vi', name: 'Tiếng Việt' }, { id: 'zh', name: '中文' }];

const CATS = {
  start: { ru: 'Начало', en: 'Getting started', kk: 'Бастау', vi: 'Bắt đầu', zh: '入门' },
  hh: { ru: 'HH-партизан', en: 'HH method', kk: 'HH әдісі', vi: 'Phương pháp HH', zh: 'HH 方法' },
  harvey: { ru: 'Харви: почта', en: 'Harvey: email', kk: 'Харви: пошта', vi: 'Harvey: email', zh: 'Harvey：邮件' },
  money: { ru: 'Кредиты и тарифы', en: 'Credits & plans', kk: 'Кредиттер мен тарифтер', vi: 'Tín dụng & gói', zh: '积分与套餐' },
  meet: { ru: 'Встречи и звонки', en: 'Meetings & calls', kk: 'Кездесулер мен қоңыраулар', vi: 'Cuộc họp & cuộc gọi', zh: '会议与通话' },
  safe: { ru: 'Безопасность', en: 'Security', kk: 'Қауіпсіздік', vi: 'Bảo mật', zh: '安全' },
};

// q/a по языкам. Цифры — только из каталога продукта (кредиты, тарифы, кейсы), без обещаний.
export const FAQ = [
  { id: 'what', cat: 'start',
    ru: ['Что делает LEADMEET OS?', 'Находит компании, где собственнику прямо сейчас больно (например, он ищет РОПа), изучает компанию и самого собственника, готовит личное сообщение его языком, ведёт до встречи и помогает провести её по скрипту.'],
    en: ['What does LEADMEET OS do?', 'It finds companies where the owner has a pain right now (e.g. hiring a head of sales), researches the company and the owner, drafts a personal message in the owner\'s own voice, and guides you to a meeting with a sales-interview script.'],
    kk: ['LEADMEET OS не істейді?', 'Иесі дәл қазір қиындыққа тап болған компанияларды табады (мысалы, сату бөлімінің басшысын іздейді), компания мен иесін зерттейді, оның тілімен жеке хат дайындайды және кездесуге дейін жеткізеді.'],
    vi: ['LEADMEET OS làm gì?', 'Tìm các công ty mà chủ doanh nghiệp đang gặp vấn đề ngay lúc này (ví dụ: đang tuyển trưởng phòng kinh doanh), nghiên cứu công ty và chủ sở hữu, soạn tin nhắn cá nhân theo giọng văn của họ và dẫn bạn đến cuộc họp.'],
    zh: ['LEADMEET OS 是做什么的？', '它寻找老板此刻正有痛点的公司（例如正在招聘销售主管），研究公司和老板本人，用老板自己的语气起草个人信息，并按销售访谈脚本带你走到会面。'] },
  { id: 'first', cat: 'start',
    ru: ['С чего начать в первый день?', 'Откройте «Мастер запуска»: подключите hh.ru и Telegram-бота, впишите свои кейсы с цифрами, нажмите «Найти сигналы». Дальше каждое утро — «Конвейер»: скопировать → открыть чат → отправлено.'],
    en: ['Where do I start on day one?', 'Open the Launch wizard: connect hh.ru and the Telegram bot, add your case studies with real numbers, press "Find signals". Then every morning use the Conveyor: copy → open chat → sent.'],
    kk: ['Бірінші күні неден бастау керек?', '«Іске қосу шеберін» ашыңыз: hh.ru мен Telegram-ботты қосыңыз, нақты сандары бар кейстеріңізді жазыңыз, «Сигналдарды табу» батырмасын басыңыз. Әр таңертең — «Конвейер».'],
    vi: ['Ngày đầu tiên bắt đầu từ đâu?', 'Mở "Trình hướng dẫn khởi chạy": kết nối hh.ru và bot Telegram, thêm các case có số liệu thật, nhấn "Tìm tín hiệu". Sau đó mỗi sáng dùng "Băng chuyền": sao chép → mở chat → đã gửi.'],
    zh: ['第一天从哪里开始？', '打开"启动向导"：连接 hh.ru 和 Telegram 机器人，填写带真实数据的案例，点击"查找信号"。之后每天早上使用"传送带"：复制 → 打开聊天 → 已发送。'] },
  { id: 'signal', cat: 'hh',
    ru: ['Почему вакансия — лучший повод написать?', 'Если компания ищет РОПа или коммерческого директора, собственник сам отбирает кандидатов и прямо сейчас думает о продажах. Это честный повод для разговора, пока вакансия открыта.'],
    en: ['Why is a job posting the best reason to reach out?', 'When a company hires a head of sales, the owner screens candidates personally and is thinking about sales right now. It is an honest reason to talk while the vacancy is open.'],
    kk: ['Неліктен вакансия — жазудың ең жақсы себебі?', 'Компания сату бөлімінің басшысын іздесе, иесі үміткерлерді өзі таңдайды және дәл қазір сату туралы ойлайды. Вакансия ашық тұрғанда — бұл әңгімеге адал себеп.'],
    vi: ['Vì sao tin tuyển dụng là lý do tốt nhất để liên hệ?', 'Khi công ty tuyển trưởng phòng kinh doanh, chủ doanh nghiệp tự sàng lọc ứng viên và đang nghĩ về bán hàng. Đó là lý do trung thực để trò chuyện khi vị trí còn mở.'],
    zh: ['为什么招聘信息是最好的联系理由？', '公司招聘销售主管时，老板会亲自筛选候选人，此刻正在思考销售问题。职位开放期间，这是一个真诚的沟通理由。'] },
  { id: 'captcha', cat: 'hh',
    ru: ['Что делать, если hh.ru показал капчу?', 'Капчу вводит человек: приложение пришлёт ссылку, откройте её с телефона, введите символы и вернитесь в конвейер. Обходить защиту мы не будем — так аккаунт живёт долго.'],
    en: ['What if hh.ru shows a captcha?', 'A human solves it: the app sends you a link, open it on your phone, type the characters and return to the conveyor. We never bypass protection — that keeps the account alive.'],
    kk: ['hh.ru капча көрсетсе не істеу керек?', 'Капчаны адам енгізеді: қосымша сілтеме жібереді, оны телефоннан ашып, таңбаларды енгізіңіз. Қорғанысты айналып өтпейміз — аккаунт ұзақ өмір сүреді.'],
    vi: ['Nếu hh.ru hiện captcha thì sao?', 'Con người giải captcha: ứng dụng gửi liên kết, mở bằng điện thoại, nhập ký tự và quay lại băng chuyền. Chúng tôi không vượt qua bảo vệ — để tài khoản sống lâu.'],
    zh: ['如果 hh.ru 显示验证码怎么办？', '由人工输入：应用会发送链接，用手机打开，输入字符后回到传送带。我们从不绕过保护——这样账号才能长期使用。'] },
  { id: 'harvey', cat: 'harvey',
    ru: ['Чем «Харви: почта» отличается от HH-партизана?', 'Харви берёт компании из открытых источников (карты, сайты, ЕГРЮЛ), находит сигнал — нанимают в продажи, несколько филиалов, чат без CRM — и пишет 2 коротких письма. Вы одобряете первое, второе уйдёт через 3 дня, только если нет ответа.'],
    en: ['How is "Harvey: email" different from the HH method?', 'Harvey takes companies from open sources (maps, websites, registries), detects a signal — hiring in sales, several branches, chat without CRM — and writes 2 short emails. You approve the first; the second goes 3 days later only if there is no reply.'],
    kk: ['«Харви: пошта» HH әдісінен немен ерекшеленеді?', 'Харви компанияларды ашық дереккөздерден алады (карталар, сайттар, тізілімдер), сигнал табады және 2 қысқа хат жазады. Біріншісін сіз мақұлдайсыз, екіншісі жауап болмаса ғана 3 күннен кейін кетеді.'],
    vi: ['"Harvey: email" khác phương pháp HH thế nào?', 'Harvey lấy công ty từ nguồn mở (bản đồ, website, sổ đăng ký), phát hiện tín hiệu và viết 2 email ngắn. Bạn duyệt email đầu; email thứ hai chỉ gửi sau 3 ngày nếu chưa có phản hồi.'],
    zh: ['"Harvey：邮件"和 HH 方法有什么不同？', 'Harvey 从公开来源（地图、网站、工商登记）获取公司，识别信号，然后写两封简短邮件。第一封由你批准；第二封仅在 3 天内无回复时发送。'] },
  { id: 'spam', cat: 'harvey',
    ru: ['Письма не попадут в спам?', 'Помогает честная гигиена: свой домен с SPF, DKIM и DMARC, прогрев (несколько писем в день с ростом), короткие письма без ссылок-ловушек, фраза-отписка и отправка в рабочее время получателя. Проверку домена найдёте в разделе «Харви».'],
    en: ['Will the emails land in spam?', 'Honest hygiene helps: your own domain with SPF, DKIM and DMARC, warm-up (a few emails a day, growing), short emails without link tricks, an opt-out line and sending in the recipient\'s business hours. Domain check is in the Harvey section.'],
    kk: ['Хаттар спамға түспей ме?', 'Адал гигиена көмектеседі: SPF, DKIM, DMARC бар өз доменіңіз, қыздыру, сілтемесіз қысқа хаттар, бас тарту сөйлемі және алушының жұмыс уақытында жіберу.'],
    vi: ['Email có vào thư rác không?', 'Vệ sinh trung thực giúp ích: tên miền riêng có SPF, DKIM, DMARC, làm nóng dần, email ngắn không có liên kết lừa, dòng hủy đăng ký và gửi trong giờ làm việc của người nhận.'],
    zh: ['邮件会进垃圾箱吗？', '诚实的发信规范最有效：使用配置了 SPF、DKIM、DMARC 的自有域名，逐步预热，简短无陷阱链接，附退订语，并在收件人工作时间发送。'] },
  { id: 'credits', cat: 'money',
    ru: ['За что списываются кредиты?', 'Исследование компании — 1 кредит, шаблонное сообщение — 1, сообщение от Claude — 2, разбор звонка — 5, минута расшифровки — 1. Просмотр, аналитика и конвейер — бесплатно.'],
    en: ['What are credits spent on?', 'Company research — 1 credit, template message — 1, Claude-written message — 2, call analysis — 5, one minute of transcription — 1. Viewing, analytics and the conveyor are free.'],
    kk: ['Кредиттер не үшін жұмсалады?', 'Компанияны зерттеу — 1 кредит, үлгі хабарлама — 1, Claude хабарламасы — 2, қоңырауды талдау — 5, транскрипцияның бір минуты — 1. Қарау мен аналитика — тегін.'],
    vi: ['Tín dụng được dùng cho gì?', 'Nghiên cứu công ty — 1, tin nhắn mẫu — 1, tin nhắn do Claude viết — 2, phân tích cuộc gọi — 5, một phút chép lời — 1. Xem, phân tích và băng chuyền — miễn phí.'],
    zh: ['积分用在哪里？', '公司调研 1 积分，模板消息 1，Claude 撰写的消息 2，通话分析 5，每分钟转录 1。浏览、分析和传送带免费。'] },
  { id: 'currency', cat: 'money',
    ru: ['Можно считать в тенге, донгах или юанях?', 'Да. В «Настройках» выберите вторую валюту и рынки: цены офферов пересчитаются в KZT, VND, CNY, AED, EUR и другие по курсу ЦБ.'],
    en: ['Can I see prices in tenge, dong or yuan?', 'Yes. In Settings choose a second currency and markets: offer prices are converted to KZT, VND, CNY, AED, EUR and more at the central bank rate.'],
    kk: ['Теңгемен, донгпен немесе юаньмен есептеуге бола ма?', 'Иә. «Баптауларда» екінші валюта мен нарықтарды таңдаңыз: бағалар KZT, VND, CNY, AED, EUR және басқаларға қайта есептеледі.'],
    vi: ['Có thể tính bằng tenge, đồng hoặc nhân dân tệ không?', 'Có. Trong Cài đặt, chọn đơn vị tiền tệ thứ hai và thị trường: giá được quy đổi sang KZT, VND, CNY, AED, EUR và các loại khác.'],
    zh: ['可以用坚戈、越南盾或人民币计价吗？', '可以。在"设置"中选择第二币种和市场：报价会按央行汇率换算成 KZT、VND、CNY、AED、EUR 等。'] },
  { id: 'agent', cat: 'money',
    ru: ['Как стать агентом?', 'Кнопка «Стать агентом» даёт личную ссылку. Кабинеты, открытые по ней, записываются за вами, а с их оплат начисляется процент.'],
    en: ['How do I become an agent?', 'The "Become an agent" button gives you a personal link. Workspaces opened through it are attributed to you, and you earn a percentage of their payments.'],
    kk: ['Агент қалай болуға болады?', '«Агент болу» батырмасы жеке сілтеме береді. Ол арқылы ашылған кабинеттер сізге жазылады, олардың төлемдерінен пайыз есептеледі.'],
    vi: ['Làm sao để trở thành đại lý?', 'Nút "Trở thành đại lý" cho bạn một liên kết cá nhân. Các tài khoản mở qua đó được ghi cho bạn và bạn nhận phần trăm từ thanh toán của họ.'],
    zh: ['如何成为代理？', '"成为代理"按钮会给你一个专属链接。通过它开通的账户归属于你，你可从其付款中获得提成。'] },
  { id: 'script', cat: 'meet',
    ru: ['Как пройдёт встреча?', 'Перед встречей система собирает факты о компании и даёт скрипт продающего интервью: вопросы о цифрах, цене бездействия и следующем шаге. Запись звонка можно загрузить — придёт разбор с ошибками и сильными местами.'],
    en: ['How does the meeting go?', 'Before the meeting the system gathers facts about the company and gives a sales-interview script: questions about numbers, cost of inaction and the next step. Upload the call recording to get a review.'],
    kk: ['Кездесу қалай өтеді?', 'Кездесу алдында жүйе компания туралы деректерді жинап, сату сұхбатының сценарийін береді. Қоңырау жазбасын жүктесеңіз — талдау келеді.'],
    vi: ['Cuộc họp diễn ra thế nào?', 'Trước cuộc họp, hệ thống thu thập dữ kiện về công ty và đưa ra kịch bản phỏng vấn bán hàng. Tải bản ghi cuộc gọi lên để nhận phân tích.'],
    zh: ['会议怎么进行？', '会前系统收集公司信息并给出销售访谈脚本：关于数字、不作为的代价和下一步的问题。上传通话录音即可获得复盘。'] },
  { id: 'data', cat: 'safe',
    ru: ['Где хранятся мои данные?', 'На вашем сервере или компьютере, в зашифрованных бэкапах. Пароли — только в виде хеша scrypt, ключи сервисов зашифрованы, все действия пишутся в журнал с защитой от подмены.'],
    en: ['Where is my data stored?', 'On your own server or computer, with encrypted backups. Passwords are stored only as scrypt hashes, service keys are encrypted, and every action goes to a tamper-evident log.'],
    kk: ['Деректерім қайда сақталады?', 'Өз серверіңізде немесе компьютеріңізде, шифрланған сақтық көшірмелермен. Құпиясөздер тек scrypt хеші түрінде сақталады.'],
    vi: ['Dữ liệu của tôi được lưu ở đâu?', 'Trên máy chủ hoặc máy tính của bạn, có sao lưu mã hóa. Mật khẩu chỉ lưu dạng băm scrypt, khóa dịch vụ được mã hóa, mọi thao tác được ghi nhật ký chống sửa đổi.'],
    zh: ['我的数据存在哪里？', '存放在你自己的服务器或电脑上，并有加密备份。密码仅以 scrypt 哈希保存，服务密钥加密，所有操作写入防篡改日志。'] },
  { id: 'gos', cat: 'safe',
    ru: ['Почему кнопка «Госуслуги» показывает кота?', 'Это напоминание: настоящие Госуслуги живут только на gosuslugi.ru и не просят входить через сторонние сайты. Кот проверяет, что вы это помните.'],
    en: ['Why does the "Gosuslugi" button show a cat?', 'It is a reminder: the real government portal lives only at gosuslugi.ru and never asks you to sign in via third-party sites. The cat checks you remember that.'],
    kk: ['Неліктен «Госуслуги» батырмасы мысықты көрсетеді?', 'Бұл ескерту: нағыз Госуслуги тек gosuslugi.ru сайтында және бөгде сайттар арқылы кіруді сұрамайды.'],
    vi: ['Vì sao nút "Gosuslugi" hiện con mèo?', 'Đó là lời nhắc: cổng dịch vụ công thật chỉ ở gosuslugi.ru và không bao giờ yêu cầu đăng nhập qua trang khác.'],
    zh: ['为什么"Gosuslugi"按钮显示一只猫？', '这是提醒：真正的政务门户只在 gosuslugi.ru，从不要求通过第三方网站登录。猫咪在确认你记得这一点。'] },
];

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
const store = { get() { try { return JSON.parse(localStorage.getItem('lm-faq-marks') || '[]'); } catch { return []; } }, set(v) { try { localStorage.setItem('lm-faq-marks', JSON.stringify(v)); } catch { /* закладки живут до перезагрузки */ } } };
let memMarks = null;
const marks = () => (memMarks ??= store.get());

function hl(text, q) {
  const t = esc(text); if (!q) return t;
  let n = norm(q); let i = norm(text).indexOf(n);
  if (i < 0 && n.length > 4) { n = n.slice(0, n.length > 5 ? -2 : -1); i = norm(text).indexOf(n); q = q.slice(0, n.length); }
  if (i < 0) return t;
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

export function openFaq() {
  if (document.getElementById('faq')) return;
  let lang = (navigator.language || 'ru').slice(0, 2); if (!LANGS.some(l => l.id === lang)) lang = 'ru';
  let cat = 'all', q = '';
  const el = document.createElement('div');
  el.id = 'faq'; el.className = 'faq'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Тайная библиотека');
  document.body.appendChild(el);
  const prevFocus = document.activeElement;

  // Простое «стеммирование»: «капча» находит «капчу», «кредиты» — «кредитов».
  const stems = (t) => norm(t).split(/[^a-zа-яё0-9\u00c0-\u024f\u0400-\u04ff\u4e00-\u9fff]+/i).filter(Boolean).map(w => w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w);
  const hit = (text, nq) => { if (!nq) return true; const t = norm(text); if (t.includes(nq)) return true; const st = stems(nq); return st.length > 0 && st.every(w => t.includes(w)); };
  function items() {
    const nq = norm(q.trim());
    return FAQ.filter(f => (cat === 'all' || (cat === 'marks' ? marks().includes(f.id) : f.cat === cat)))
      .map(f => { const own = f[lang] || f.ru; if (hit(own.join(' '), nq)) return { f, qa: own, l: lang };
        const other = [LANGS[0], ...LANGS.slice(1)].find(L => f[L.id] && hit(f[L.id].join(' '), nq)); return other ? { f, qa: f[other.id], l: other.id } : null; })
      .filter(Boolean);
  }
  function render(keepFocus) {
    const list = items();
    el.innerHTML = `<div class="faq-box">
      <div class="faq-top"><div><span class="label">✦ Тайная библиотека</span><h2>Ответы на всё</h2></div><button class="btn ghost" data-faq-close aria-label="Закрыть">✕</button></div>
      <input class="faq-search" type="search" placeholder="Поиск на любом языке: «капча», «credits», «积分»…" value="${esc(q)}" aria-label="Поиск по вопросам">
      <div class="faq-langs" role="tablist">${LANGS.map(L => `<button class="chip ${L.id === lang ? 'on' : ''}" data-lang="${L.id}" role="tab" aria-selected="${L.id === lang}">${L.name}</button>`).join('')}</div>
      <div class="faq-body">
        <nav class="faq-cats">${[['all', { ru: 'Все', en: 'All', kk: 'Барлығы', vi: 'Tất cả', zh: '全部' }], ...Object.entries(CATS), ['marks', { ru: '★ Закладки', en: '★ Bookmarks', kk: '★ Бетбелгілер', vi: '★ Dấu trang', zh: '★ 书签' }]]
          .map(([id, n]) => `<button class="${id === cat ? 'on' : ''}" data-cat="${id}">${esc(n[lang] || n.ru)}${id === 'marks' ? ` <span class="mute">${marks().length}</span>` : ''}</button>`).join('')}</nav>
        <div class="faq-list">${list.length ? list.map(({ f, qa, l }) => `<details class="faq-item" ${q ? 'open' : ''}><summary><span>${hl(qa[0], q.trim())}${l !== lang ? ` <span class="chip xs">${l.toUpperCase()}</span>` : ''}</span><button class="mark ${marks().includes(f.id) ? 'on' : ''}" data-mark="${f.id}" aria-label="Закладка" aria-pressed="${marks().includes(f.id)}">★</button></summary><p>${hl(qa[1], q.trim())}</p><span class="xs mute">${esc((CATS[f.cat][lang] || CATS[f.cat].ru))}</span></details>`).join('')
          : `<p class="mute">${cat === 'marks' ? 'Закладок пока нет — нажмите ★ у вопроса.' : 'Ничего не нашлось. Попробуйте другое слово или язык.'}</p>`}</div>
      </div></div>`;
    const s = el.querySelector('.faq-search');
    if (keepFocus) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  }
  el.addEventListener('input', (e) => { if (e.target.classList.contains('faq-search')) { q = e.target.value; render(true); } });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (e.target === el) return close(); if (!t) return;
    if (t.dataset.faqClose !== undefined) return close();
    if (t.dataset.lang) { lang = t.dataset.lang; render(); }
    if (t.dataset.cat) { cat = t.dataset.cat; render(); }
    if (t.dataset.mark) { e.preventDefault(); const m = marks(); const i = m.indexOf(t.dataset.mark); if (i < 0) m.push(t.dataset.mark); else m.splice(i, 1); store.set(m); render(); }
  });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() { document.removeEventListener('keydown', onKey); el.remove(); prevFocus?.focus?.(); }
  render(true);
}
