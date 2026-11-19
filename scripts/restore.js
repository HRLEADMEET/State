// Восстановление: npm run restore -- data/backups/<файл>.enc data/restored.db
// Затем остановите сервер, замените data/leadmeet.db восстановленным файлом и запустите снова.
import path from 'node:path';
import { restoreBackup } from '../server/backup.js';

const [file, target = 'data/restored.db'] = process.argv.slice(2);
if (!file) { console.error('Укажите файл бэкапа: npm run restore -- data/backups/<файл>.enc [куда.db]'); process.exit(1); }
const r = restoreBackup(path.resolve(file), path.resolve(target));
console.log('Восстановлено в', r.target, Math.round(r.bytes / 1024) + ' КБ. Нужен тот же мастер-ключ, что при создании бэкапа.');
