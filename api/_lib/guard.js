import { createHash, timingSafeEqual } from 'node:crypto';

/** IP do cliente (a Vercel preenche x-forwarded-for). */
export function clientIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0].trim() : req.socket?.remoteAddress) || 'unknown';
}

/** Código de acesso compartilhado. Sem LILY_ACCESS_CODE no servidor, tudo é recusado (falha fechada). */
export function checkAccess(req, code = process.env.LILY_ACCESS_CODE) {
  if (!code) return { ok: false, status: 503, error: 'not_configured' };
  let given = String(req.headers['x-lily-key'] || '');
  try { given = decodeURIComponent(given); } catch { /* usa bruto */ }
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(code).digest();
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, status: 401, error: 'unauthorized' };
}

/** Só aceita requisições do próprio site (ou de ALLOWED_ORIGINS). Sem cabeçalho Origin = não é navegador: segue. */
export function checkOrigin(req, allowed = process.env.ALLOWED_ORIGINS || '') {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    if (new URL(origin).host === req.headers.host) return true;
  } catch { return false; }
  return allowed.split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}

// Limite por IP em memória: protege contra abuso simples, mas cada instância serverless tem o seu contador.
const buckets = new Map();
export function rateLimit(ip, opts = {}, now = Date.now()) {
  const perMin = opts.perMin ?? (Number(process.env.RATE_PER_MIN) || 12);
  const perDay = opts.perDay ?? (Number(process.env.RATE_PER_DAY) || 300);
  let b = buckets.get(ip);
  if (!b) { b = { min: [], dayStart: now, dayCount: 0 }; buckets.set(ip, b); }
  b.min = b.min.filter(t => now - t < 60_000);
  if (now - b.dayStart >= 86_400_000) { b.dayStart = now; b.dayCount = 0; }
  if (b.min.length >= perMin) return { ok: false, retryAfter: Math.max(1, Math.ceil((60_000 - (now - b.min[0])) / 1000)) };
  if (b.dayCount >= perDay) return { ok: false, retryAfter: Math.ceil((86_400_000 - (now - b.dayStart)) / 1000) };
  b.min.push(now); b.dayCount++;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.dayStart > 86_400_000) buckets.delete(k);
  return { ok: true };
}
export const _resetRateLimit = () => buckets.clear();
