// Зашифрованные бэкапы базы: VACUUM INTO → gzip → AES-256-GCM. Ротация по количеству.
// Восстановление: npm run restore -- data/backups/<файл>.enc
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.js';
import { encryptBuffer, decryptBuffer, sha256 } from './security.js';

export const BACKUP_DIR = path.join(config.dataDir, 'backups');

export function backupNow(db, { keep = config.backupKeep } = {}) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const tmp = path.join(BACKUP_DIR, `.tmp-${stamp}.db`);
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  const raw = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const enc = encryptBuffer(zlib.gzipSync(raw, { level: 9 }));
  const file = path.join(BACKUP_DIR, `leadmeet-${stamp}.db.gz.enc`);
  fs.writeFileSync(file, enc, { mode: 0o600 });
  const files = listBackups();
  for (const f of files.slice(keep)) fs.unlinkSync(path.join(BACKUP_DIR, f.name));
  return { file, bytes: enc.length, sha256: sha256(enc), sourceBytes: raw.length };
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.enc')).map(name => ({ name, bytes: fs.statSync(path.join(BACKUP_DIR, name)).size })).sort((a, b) => b.name.localeCompare(a.name));
}

export function restoreBackup(file, target) {
  const raw = zlib.gunzipSync(decryptBuffer(fs.readFileSync(file)));
  fs.writeFileSync(target, raw, { mode: 0o600 });
  return { target, bytes: raw.length };
}
