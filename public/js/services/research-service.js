/**
 * Pesquisa escolar real — RESERVADO para uma fase futura (backend: api/search.js, hoje responde 501).
 * Um modelo de linguagem sozinho NÃO pesquisa na internet. Quando existir, search() só deve devolver
 * resultados verificáveis vindos de uma busca de verdade: { title, url, snippet, source, retrievedAt }.
 */
export const ResearchService = {
  available: false,
  async search(/* query */) {
    throw new Error('A pesquisa na internet ainda não foi implementada.');
  }
};
