// Конфигурация из окружения и .env. Секреты не логируются.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadDotEnv(path.join(ROOT, '.env'));

const env = process.env;
export const config = {
  port: Number(env.PORT || 8787),
  host: env.HOST || '127.0.0.1',
  baseUrl: (env.BASE_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/$/, ''),
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
  demoMode: env.DEMO_MODE === 'true',
  allowSignup: env.ALLOW_SIGNUP === 'true',
  secureCookies: env.SECURE_COOKIES === 'true' || (env.BASE_URL || '').startsWith('https://'),
  sessionDays: Number(env.SESSION_DAYS || 14),
  backupEveryHours: Number(env.BACKUP_EVERY_HOURS || 24),
  backupKeep: Number(env.BACKUP_KEEP || 14),
  anthropicKey: env.ANTHROPIC_API_KEY || '',
  llmModel: env.LLM_MODEL || 'claude-opus-5-5',
  hhUserAgent: env.HH_USER_AGENT || '',
  telegramBotToken: env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: env.TELEGRAM_CHAT_ID || '',
  transcribe: { provider: env.TRANSCRIBE_PROVIDER || '', key: env.TRANSCRIBE_API_KEY || '', url: env.TRANSCRIBE_URL || '' },
  oauth: {
    google: { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET },
    yandex: { id: env.YANDEX_CLIENT_ID, secret: env.YANDEX_CLIENT_SECRET },
    vk: { id: env.VK_CLIENT_ID, secret: env.VK_CLIENT_SECRET },
  },
  fetchTimeoutMs: Number(env.FETCH_TIMEOUT_MS || 12000),
};

fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

/**
 * Мастер-ключ шифрует секреты (пароли SMTP, токены) и бэкапы.
 * Источник: LEADMEET_MASTER_KEY (base64, 32 байта) или файл data/master.key (создаётся один раз, права 600).
 * ВАЖНО: храните копию ключа отдельно от бэкапов — без него зашифрованные данные не восстановить.
 */
function loadMasterKey() {
  if (env.LEADMEET_MASTER_KEY) {
    const k = Buffer.from(env.LEADMEET_MASTER_KEY, 'base64');
    if (k.length !== 32) throw new Error('LEADMEET_MASTER_KEY должен быть 32 байта в base64');
    return k;
  }
  const file = path.join(config.dataDir, 'master.key');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
    console.log('[security] Создан новый мастер-ключ: ' + file + ' — сохраните копию в надёжном месте (менеджер паролей).');
  }
  return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
}
export const MASTER_KEY = loadMasterKey();
