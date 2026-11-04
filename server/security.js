// Безопасность: пароли (scrypt), токены, шифрование секретов (AES-256-GCM), TOTP (RFC 6238),
// ограничение частоты запросов, журнал целостности с хеш-цепочкой (как в блокчейне: любое
// изменение прошлой записи ломает все последующие хеши и сразу видно при проверке).
import crypto from 'node:crypto';
import { MASTER_KEY } from './config.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(String(password), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [alg, n, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const dk = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), SCRYPT.keylen, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
    return crypto.timingSafeEqual(dk, Buffer.from(hash, 'base64'));
  } catch { return false; }
}

export function passwordProblems(pw = '') {
  const p = [];
  if (pw.length < 10) p.push('минимум 10 символов');
  if (!/[0-9]/.test(pw) || !/[a-zа-яё]/i.test(pw)) p.push('буквы и цифры');
  if (/^(.)\1+$/.test(pw) || ['qwerty123456', '1234567890', 'password123'].includes(pw.toLowerCase())) p.push('не слишком простой');
  return p;
}

export const token = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---- секреты ----
export function seal(plain, key = MASTER_KEY) {
  if (plain === '' || plain == null) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'enc:v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function unseal(value, key = MASTER_KEY) {
  if (!value || !String(value).startsWith('enc:v1:')) return value || '';
  const buf = Buffer.from(String(value).slice(7), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

export function encryptBuffer(buf, key = MASTER_KEY) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([Buffer.from('LMBK1'), iv, c.getAuthTag(), ct]);
}

export function decryptBuffer(buf, key = MASTER_KEY) {
  if (buf.subarray(0, 5).toString() !== 'LMBK1') throw new Error('Не похоже на бэкап LEADMEET');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(5, 17));
  d.setAuthTag(buf.subarray(17, 33));
  return Buffer.concat([d.update(buf.subarray(33)), d.final()]);
}

// ---- TOTP (Google Authenticator, Яндекс Ключ и т.п.) ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function unbase32(s) {
  let bits = 0, val = 0; const out = [];
  for (const ch of String(s).replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function totp(secret, t = Date.now(), step = 30, digits = 6) {
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / step)));
  const h = crypto.createHmac('sha1', unbase32(secret)).update(ctr).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}
export function verifyTotp(secret, code, window = 1) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  for (let w = -window; w <= window; w++) if (totp(secret, Date.now() + w * 30000) === c) return true;
  return false;
}
export const newTotpSecret = () => base32(crypto.randomBytes(20));

// ---- ограничение частоты (защита от перебора паролей и злоупотреблений) ----
export class RateLimiter {
  constructor(limit, windowMs) { this.limit = limit; this.windowMs = windowMs; this.hits = new Map(); }
  hit(key) {
    const now = Date.now();
    const arr = (this.hits.get(key) || []).filter(t => now - t < this.windowMs);
    arr.push(now); this.hits.set(key, arr);
    if (this.hits.size > 50000) this.hits.clear();
    return arr.length <= this.limit;
  }
}

// ---- хеш-цепочка аудита ----
export function chainHash(prev, entry) {
  return sha256(prev + '|' + entry.at + '|' + entry.ws + '|' + (entry.user || '') + '|' + entry.action + '|' + JSON.stringify(entry.data ?? null));
}
