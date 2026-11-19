// Ручной бэкап: npm run backup → data/backups/leadmeet-<дата>.db.gz.enc
import { openDb } from '../server/db.js';
import { backupNow } from '../server/backup.js';

const b = backupNow(openDb());
console.log('Бэкап создан:', b.file, Math.round(b.bytes / 1024) + ' КБ', 'sha256:', b.sha256);
