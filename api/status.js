import { json } from './_lib/http.js';

/** Diz só se o servidor está configurado. Não revela chaves, modelo nem código. */
export default function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'method_not_allowed' }); }
  json(res, 200, { ok: true, ready: Boolean(process.env.GROQ_API_KEY && process.env.LILY_ACCESS_CODE) });
}
