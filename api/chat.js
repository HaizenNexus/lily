import { checkAccess, checkOrigin, clientIp, rateLimit } from './_lib/guard.js';
import { json, readJson, prepareMessages } from './_lib/http.js';
import { buildSystemPrompt } from './_lib/persona.js';
import { streamCompletion, UpstreamError } from './_lib/groq.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }

  // 1) limite de uso (antes da autenticação, para também frear tentativas de adivinhar o código)
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) return json(res, 429, { error: 'rate_limited', retryAfter: rl.retryAfter }, { 'Retry-After': String(rl.retryAfter) });
  // 2) origem e código de acesso
  if (!checkOrigin(req)) return json(res, 403, { error: 'forbidden_origin' });
  const access = checkAccess(req);
  if (!access.ok) return json(res, access.status, { error: access.error });
  if (!process.env.GROQ_API_KEY) return json(res, 503, { error: 'not_configured' });

  // 3) entrada
  let input;
  try { input = await readJson(req); }
  catch (e) { return json(res, e.status || 400, { error: e.status === 413 ? 'too_large' : 'bad_request' }); }
  const history = prepareMessages(input?.messages);
  if (!history) return json(res, 400, { error: 'bad_request' });

  const messages = [{ role: 'system', content: buildSystemPrompt({ ...input.settings, memories: input.memories }) }, ...history];

  // 4) streaming: só abre a resposta quando o primeiro pedaço chegar, para ainda poder devolver erro JSON
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  const timeout = setTimeout(() => ac.abort(), 25_000);
  try {
    const it = streamCompletion({ messages, signal: ac.signal })[Symbol.asyncIterator]();
    let first = await it.next();
    if (first.done) return json(res, 502, { error: 'empty_response' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');
    while (!first.done) { res.write(first.value); first = await it.next(); }
    res.end();
  } catch (e) {
    if (e.name === 'AbortError') return res.writableEnded ? undefined : res.end();
    const err = e instanceof UpstreamError ? e : new UpstreamError('upstream_error', 502);
    console.error('[lily] falha na IA:', err.code); // sem conteúdo de conversa nos logs
    if (res.headersSent) return res.end();
    const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
    return json(res, err.status, { error: err.code === 'upstream_auth' ? 'upstream_error' : err.code, ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}) }, headers);
  } finally { clearTimeout(timeout); }
}
