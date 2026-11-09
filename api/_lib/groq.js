export class UpstreamError extends Error {
  constructor(code, status, extra = {}) { super(code); this.code = code; this.status = status; Object.assign(this, extra); }
}

/** Chama a Groq (API compatível com OpenAI) e devolve só os pedaços de texto da resposta. */
export async function* streamCompletion({ messages, signal, env = process.env }) {
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const base = env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  const body = { model, messages, stream: true, temperature: 0.7, max_completion_tokens: 700 };
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low'; // respostas mais rápidas

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify(body)
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new UpstreamError('upstream_unreachable', 502);
  }
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after')) || null;
    if (res.status === 429) throw new UpstreamError('rate_limited', 429, { retryAfter: retryAfter ?? 20 });
    if (res.status === 413) throw new UpstreamError('too_large', 413);
    // 401/403 = chave inválida no servidor: não vaza detalhe ao cliente
    throw new UpstreamError(res.status === 401 || res.status === 403 ? 'upstream_auth' : 'upstream_error', 502);
  }

  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const text = JSON.parse(data).choices?.[0]?.delta?.content; // ignora "reasoning"
        if (text) yield text;
      } catch { /* linha parcial ou irrelevante */ }
    }
  }
}
