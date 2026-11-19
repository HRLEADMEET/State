// Загрузка публичных страниц: сайт компании, страницы команды, публичная веб-версия Telegram-канала.
// Защита от SSRF: только http/https и стандартные порты, IP проверяется В МОМЕНТ СОЕДИНЕНИЯ
// (собственный lookup — нельзя обойти DNS-подменой), запрет внутренних/служебных диапазонов IPv4/IPv6
// (включая IPv4-mapped IPv6), ручная проверка каждого редиректа, таймаут и лимит размера.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import { config } from '../config.js';

const BLOCK = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) BLOCK.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]) BLOCK.addSubnet(a, p, 'ipv6');

export function isBlockedIp(address) {
  let a = String(address || '').replace(/^\[|\]$/g, '');
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) a = mapped[1];
  else if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i.test(a)) { // ::ffff:7f00:1 → 127.0.0.1
    const [, h1, h2] = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    const n1 = parseInt(h1, 16), n2 = parseInt(h2, 16);
    a = [n1 >> 8, n1 & 255, n2 >> 8, n2 & 255].join('.');
  }
  const fam = net.isIP(a);
  if (!fam) return true;
  return BLOCK.check(a, fam === 4 ? 'ipv4' : 'ipv6');
}

function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err);
    const ok = addrs.filter(x => !isBlockedIp(x.address));
    if (!ok.length || ok.length !== addrs.length) return cb(Object.assign(new Error('Внутренние адреса запрещены'), { code: 'EBLOCKED' }));
    if (options && options.all) return cb(null, ok);
    return cb(null, ok[0].address, ok[0].family);
  });
}

export function checkUrl(raw) {
  raw = String(raw || '').trim();
  const scheme = raw.match(/^([a-z][a-z0-9+-]*):/i);
  if (scheme && !/^https?$/i.test(scheme[1])) throw new Error('Разрешены только http/https');
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { throw new Error('Некорректный адрес'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Разрешены только http/https');
  if (u.username || u.password) throw new Error('Адреса с логином в ссылке запрещены');
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new Error('Нестандартный порт запрещён');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new Error('Внутренние адреса запрещены');
  if (net.isIP(host) && isBlockedIp(host)) throw new Error('Внутренние адреса запрещены');
  return u;
}

function requestOnce(u, { timeoutMs, maxBytes, headers }) {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, {
      method: 'GET', lookup: safeLookup, timeout: timeoutMs,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadmeetOS/0.9; research of public pages)', 'Accept': 'text/html,*/*;q=0.8', 'Accept-Language': 'ru,en;q=0.8', 'Accept-Encoding': 'gzip, deflate', ...headers },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, u).href }); }
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const enc = String(res.headers['content-encoding'] || '');
      const stream = enc.includes('gzip') ? res.pipe(zlib.createGunzip()) : enc.includes('deflate') ? res.pipe(zlib.createInflate()) : res;
      const chunks = []; let n = 0; let done = false;
      const finish = () => { if (done) return; done = true; resolve({ body: Buffer.concat(chunks).toString('utf8') }); };
      stream.on('data', (c) => { n += c.length; if (n > maxBytes) { chunks.push(c.subarray(0, Math.max(0, c.length - (n - maxBytes)))); req.destroy(); finish(); } else chunks.push(c); });
      stream.on('end', finish);
      stream.on('error', (e) => { if (!done) { done = true; reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('Таймаут загрузки')));
    req.on('error', (e) => reject(e.code === 'EBLOCKED' ? new Error('Внутренние адреса запрещены') : e));
    req.end();
  });
}

export async function fetchText(raw, { maxBytes = 1_200_000, timeoutMs = config.fetchTimeoutMs, headers = {} } = {}) {
  let u = checkUrl(raw);
  const started = Date.now();
  for (let hop = 0; hop < 4; hop++) {
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new Error('Таймаут загрузки');
    const r = await requestOnce(u, { timeoutMs: left, maxBytes, headers });
    if (r.redirect) { u = checkUrl(r.redirect); continue; }
    return r.body;
  }
  throw new Error('Слишком много перенаправлений');
}

/** Страницы, где обычно указаны собственник и команда. */
export const TEAM_PATHS = ['/team', '/about', '/o-kompanii', '/o-nas', '/komanda', '/company', '/kontakty', '/contacts'];

export const webService = {
  fetch: (url) => fetchText(url),
  telegram: (name) => fetchText('https://t.me/s/' + encodeURIComponent(String(name).replace(/^@/, '').slice(0, 64))),
  async teamPages(site, limit = 3) {
    const base = checkUrl(site);
    const out = [];
    for (const p of TEAM_PATHS) {
      if (out.length >= limit) break;
      try { out.push({ url: new URL(p, base).href, html: await fetchText(new URL(p, base).href, { maxBytes: 600_000, timeoutMs: 6000 }) }); } catch { /* страницы нет — пробуем следующую */ }
    }
    return out;
  },
};
