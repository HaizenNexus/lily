import { json } from './_lib/http.js';

/**
 * RESERVADO para a pesquisa escolar real (fase futura).
 * Contrato previsto: POST { query } -> { results: [{ title, url, snippet, source, retrievedAt }] }
 * Só devolver resultados que vieram de uma busca de verdade; nunca gerados pelo modelo.
 */
export default function handler(req, res) {
  json(res, 501, { error: 'not_implemented', message: 'A pesquisa na internet ainda não foi implementada.' });
}
