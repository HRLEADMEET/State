// Минимальный SMTP-клиент без зависимостей: SSL (465) и STARTTLS (587), AUTH PLAIN/LOGIN.
// Письма — только plain text в UTF-8 (так пишут люди), с заголовками List-Unsubscribe и Message-ID.
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import os from 'node:os';

function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
}
function encodeAddress(a) {
  const m = String(a).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? `${encodeHeader(m[1].replace(/"/g, ''))} <${m[2]}>` : a;
}
const bare = (a) => (String(a).match(/<([^>]+)>/) || [null, a])[1].trim();

export function buildMessage({ from, to, subject, text, replyTo, unsubscribe, messageId, inReplyTo }) {
  const domain = bare(from).split('@')[1] || os.hostname();
  const id = messageId || `<${crypto.randomUUID()}@${domain}>`;
  const headers = [
    `From: ${encodeAddress(from)}`,
    `To: ${encodeAddress(to)}`,
    `Subject: ${encodeHeader(subject || '')}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (replyTo) headers.push(`Reply-To: ${encodeAddress(replyTo)}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`);
  if (unsubscribe) headers.push(`List-Unsubscribe: <${unsubscribe}>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  const body = Buffer.from(String(text).replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
  return { raw: headers.join('\r\n') + '\r\n\r\n' + body + '\r\n', messageId: id };
}

class Conn {
  constructor(sock) { this.sock = sock; this.buf = ''; this.waiters = []; this.bind(sock); }
  bind(sock) {
    sock.setEncoding('utf8');
    sock.on('data', (d) => { this.buf += d; this.flush(); });
    sock.on('error', (e) => { while (this.waiters.length) this.waiters.shift().reject(e); });
  }
  flush() {
    // ответ завершён, когда последняя строка имеет вид "250 текст" (без дефиса)
    const m = this.buf.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/);
    if (m && this.waiters.length) { const text = this.buf; this.buf = ''; this.waiters.shift().resolve({ code: +m[1], text }); }
  }
  read() { return new Promise((resolve, reject) => { this.waiters.push({ resolve, reject }); this.flush(); }); }
  async cmd(line, expect) {
    if (line !== null) this.sock.write(line + '\r\n');
    const r = await this.read();
    if (expect && !expect.includes(r.code)) throw new Error(`SMTP ${r.code}: ${r.text.trim().slice(0, 200)}`);
    return r;
  }
}

export async function sendMail(cfg, msg, { timeoutMs = 20000 } = {}) {
  const port = Number(cfg.port || 465);
  const secure = port === 465 || cfg.secure === true;
  const host = cfg.host;
  if (!host || !cfg.user || !cfg.pass) throw new Error('SMTP не настроен: нужны сервер, логин и пароль приложения.');
  let sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  sock.setTimeout(timeoutMs, () => sock.destroy(new Error('SMTP: таймаут')));
  await new Promise((res, rej) => { sock.once(secure ? 'secureConnect' : 'connect', res); sock.once('error', rej); });
  let c = new Conn(sock);
  try {
    await c.cmd(null, [220]);
    const helo = cfg.helo || os.hostname();
    let ehlo = await c.cmd('EHLO ' + helo, [250]);
    if (!secure && /STARTTLS/i.test(ehlo.text)) {
      await c.cmd('STARTTLS', [220]);
      sock.removeAllListeners('data');
      sock = tls.connect({ socket: sock, servername: host });
      await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
      c = new Conn(sock);
      ehlo = await c.cmd('EHLO ' + helo, [250]);
    } else if (!secure) throw new Error('Сервер не поддерживает STARTTLS — отправка без шифрования запрещена.');
    if (/AUTH[^\r\n]*PLAIN/i.test(ehlo.text)) {
      await c.cmd('AUTH PLAIN ' + Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString('base64'), [235]);
    } else {
      await c.cmd('AUTH LOGIN', [334]);
      await c.cmd(Buffer.from(cfg.user).toString('base64'), [334]);
      await c.cmd(Buffer.from(cfg.pass).toString('base64'), [235]);
    }
    const { raw, messageId } = buildMessage({ ...msg, from: msg.from || cfg.from || cfg.user });
    await c.cmd(`MAIL FROM:<${bare(msg.from || cfg.from || cfg.user)}>`, [250]);
    await c.cmd(`RCPT TO:<${bare(msg.to)}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    await c.cmd(raw.replace(/\r\n\./g, '\r\n..') + '.', [250]);
    await c.cmd('QUIT', [221]).catch(() => {});
    return { messageId };
  } finally { sock.end(); }
}
