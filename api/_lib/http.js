export const json = (res, status, body, headers = {}) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
};

export const LIMITS = { bodyBytes: 40_000, maxMessages: 12, maxChars: 6000, maxPerMessage: 3000 };

export async function readJson(req, limit = LIMITS.bodyBytes) {
  if (Number(req.headers['content-length']) > limit) throw Object.assign(new Error('too_large'), { status: 413 });
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('too_large'), { status: 413 });
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** Limita o histórico enviado à IA: últimas mensagens, dentro de um teto de caracteres, começando em "user" e terminando em "user". */
export function prepareMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw.slice(-40)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, LIMITS.maxPerMessage) }));
  const out = []; let total = 0;
  for (let i = msgs.length - 1; i >= 0 && out.length < LIMITS.maxMessages; i--) {
    if (out.length && total + msgs[i].content.length > LIMITS.maxChars) break;
    total += msgs[i].content.length; out.unshift(msgs[i]);
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length && out[out.length - 1].role === 'user' ? out : null;
}
