// Клиент серверного API: cookie-сессия + заголовок CSRF.
const readCookie = (n) => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')) || [])[1];

export function serverApi() {
  const csrf = () => decodeURIComponent(readCookie('lm_csrf') || '');
  async function req(method, url, body, raw) {
    const headers = { 'x-csrf': csrf() };
    if (body !== undefined && !raw) headers['content-type'] = 'application/json';
    const res = await fetch(url, { method, headers, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(j.error || res.statusText || 'Ошибка сети'); e.status = res.status; throw e; }
    return j;
  }
  const call = (method, path, body) => req(method, '/api' + path, method === 'GET' ? undefined : (body ?? {}));
  const auth = {
    state: () => req('GET', '/api/auth/state'),
    login: (b) => req('POST', '/api/auth/login', b),
    register: (b) => req('POST', '/api/auth/register', b),
    demo: () => req('POST', '/api/auth/demo', {}),
    logout: () => req('POST', '/api/auth/logout', {}),
    logoutAll: () => req('POST', '/api/auth/logout-all', {}),
    switch: (wsId) => req('POST', '/api/auth/switch', { wsId }),
    totpSetup: () => req('POST', '/api/auth/totp/setup', {}),
    totpEnable: (code) => req('POST', '/api/auth/totp/enable', { code }),
    password: (b) => req('POST', '/api/auth/password', b),
    invite: (b) => req('POST', '/api/auth/invite', b),
    members: () => req('GET', '/api/auth/members'),
  };
  const uploadAudio = (file, p = {}) => {
    const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
    return fetch('/api/calls/audio?' + q, { method: 'POST', headers: { 'x-csrf': csrf(), 'content-type': file.type || 'audio/mpeg' }, body: file, credentials: 'same-origin' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Ошибка загрузки'); return j; });
  };
  return { mode: 'server', call, auth, uploadAudio };
}
