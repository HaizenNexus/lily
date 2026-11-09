/**
 * Camada de serviço da LILY — o ÚNICO ponto do frontend que fala com a IA.
 * Fala com /api/chat (servidor na Vercel). A chave da Groq existe só lá.
 * Contrato: POST { messages, settings, memories } -> texto puro em streaming.
 */
export class LilyError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); }
}

const MESSAGES = {
  offline: 'Você está sem internet. Seu histórico continua aqui, mas a Lily precisa de conexão para responder. Ainda não existe modo offline com IA.',
  network: 'Não consegui falar com o servidor da Lily. Tente de novo em instantes.',
  unauthorized: 'O código de acesso está ausente ou incorreto. Informe o código em Minha LILY.',
  not_configured: 'O servidor da Lily ainda não foi configurado (chave da IA ou código de acesso).',
  too_large: 'Essa conversa ficou grande demais para enviar. Comece uma nova conversa ou mande uma mensagem menor.',
  interrupted: 'A resposta foi interrompida no meio. Tente enviar de novo.',
  forbidden_origin: 'Este endereço não tem permissão para usar a Lily.'
};
export function describeError(err) {
  if (err.code === 'rate_limited') return `Muitas mensagens em pouco tempo ou limite de uso atingido. Tente de novo ${err.retryAfter ? `em cerca de ${err.retryAfter}s` : 'daqui a pouco'}.`;
  return MESSAGES[err.code] || 'A Lily não conseguiu responder agora. Tente novamente.';
}

export const LilyService = {
  endpoint: '/api/chat',
  statusEndpoint: '/api/status',
  getAccessCode: () => '',

  /** Gerador assíncrono: cada `yield` é um pedaço de texto da resposta (streaming). */
  async *stream({ messages, settings = {}, memories = [], signal }) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new LilyError('offline');
    let res;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-lily-key': encodeURIComponent(this.getAccessCode()) },
        body: JSON.stringify({
          messages: messages.slice(-12),
          settings: { userName: settings.userName, tone: settings.tone, expressions: settings.expressions },
          memories: memories.map(m => m.text).slice(0, 20)
        })
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new LilyError('network');
    }
    if (!res.ok) {
      let data = {};
      try { data = await res.json(); } catch { /* corpo não é JSON */ }
      throw new LilyError(data.error || 'server', { status: res.status, retryAfter: data.retryAfter ?? (Number(res.headers.get('retry-after')) || null) });
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield dec.decode(value, { stream: true });
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new LilyError('interrupted');
    }
  },

  /** 'ready' | 'no-config' | 'unavailable' | 'offline' */
  async checkStatus() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    try {
      const res = await fetch(this.statusEndpoint, { cache: 'no-store' });
      if (!res.ok) return 'unavailable';
      return (await res.json()).ready ? 'ready' : 'no-config';
    } catch { return 'unavailable'; }
  }
};
