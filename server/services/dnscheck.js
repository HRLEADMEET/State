// Проверка почтового домена: свой (SPF, DKIM, DMARC, MX, чёрные списки) и получателя (есть ли MX — иначе письмо отскочит).
// Это гигиена доставляемости, а не обход фильтров: письма доходят, когда домен настроен честно.
import dns from 'node:dns/promises';

const txt = async (name) => { try { return (await dns.resolveTxt(name)).map(r => r.join('')); } catch { return []; } };

export async function recipientMx(domain) {
  try { const mx = await dns.resolveMx(String(domain).toLowerCase()); return mx.length ? 'ok' : 'no_mx'; } catch (e) { return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? 'no_mx' : 'unknown'; }
}

export async function domainHealth(domain, dkimSelector = '') {
  const d = String(domain || '').toLowerCase().replace(/^.*@/, '');
  const checks = [];
  const add = (id, ok, text) => checks.push({ id, ok, text });
  const mx = await recipientMx(d); add('mx', mx === 'ok', mx === 'ok' ? 'MX есть: домен принимает почту' : 'Нет MX-записи');
  const spf = (await txt(d)).find(t => t.startsWith('v=spf1')); add('spf', !!spf, spf ? `SPF: ${spf.slice(0, 80)}` : 'Нет SPF — письма чаще уходят в спам');
  const dmarc = (await txt('_dmarc.' + d)).find(t => t.startsWith('v=DMARC1')); add('dmarc', !!dmarc, dmarc ? `DMARC: ${dmarc.slice(0, 80)}` : 'Нет DMARC — добавьте хотя бы p=none');
  if (dkimSelector) { const dk = (await txt(`${dkimSelector}._domainkey.${d}`)).find(t => /v=DKIM1|k=rsa|p=/.test(t)); add('dkim', !!dk, dk ? 'DKIM найден' : `DKIM не найден для селектора «${dkimSelector}»`); }
  else add('dkim', null, 'Укажите DKIM-селектор почтового сервиса (например, mail для Яндекс 360), чтобы проверить подпись');
  for (const bl of ['dbl.spamhaus.org', 'multi.surbl.org']) {
    let listed = false; try { listed = (await dns.resolve4(`${d}.${bl}`)).some(a => a.startsWith('127.0.')); } catch { listed = false; }
    add('bl_' + bl, !listed, listed ? `Домен в чёрном списке ${bl}` : `Не в списке ${bl}`);
  }
  return { domain: d, checks, ok: checks.every(c => c.ok !== false) };
}
