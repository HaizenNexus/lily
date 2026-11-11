
import { checkAccess, checkOrigin, clientIp, rateLimit } from './_lib/guard.js';
import { json, readJson } from './_lib/http.js';

const clean = (value, max = 2500) =>
  String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export default async function handler(req, res) {
  // Aceita somente POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'method_not_allowed' });
  }

  // Proteção básica contra excesso de pesquisas
  const rl = rateLimit(`search:${clientIp(req)}`, {
    perMin: 5,
    perDay: 30
  });

  if (!rl.ok) {
    return json(res, 429, { error: 'rate_limited' });
  }

  // Proteção de origem e acesso
  if (!checkOrigin(req)) {
    return json(res, 403, { error: 'forbidden_origin' });
  }

  const access = checkAccess(req);

  if (!access.ok) {
    return json(res, access.status, { error: access.error });
  }

  // Verifica se a chave da Tavily existe na Vercel
  if (!process.env.TAVILY_API_KEY) {
    return json(res, 503, { error: 'search_not_configured' });
  }

  // Recebe a pergunta
  let input;

  try {
    input = await readJson(req, 8000);
  } catch (error) {
    return json(res, error.status || 400, {
      error: 'bad_request'
    });
  }

  const query =
    typeof input?.query === 'string'
      ? clean(input.query, 500)
      : '';

  if (query.length < 2) {
    return json(res, 400, { error: 'invalid_query' });
  }

  // Consulta à Tavily
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    const response = await fetch(
      'https://api.tavily.com/search',
      {
        method: 'POST',
        signal: controller.signal,

        headers: {
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          query,
          search_depth: 'basic',
          topic: 'general',
          max_results: 5,
          include_answer: false,
          include_raw_content: false,
          include_published_date: true,
          include_usage: true,
          safe_search: true
        })
      }
    );

    // Trata erros da API
    if (!response.ok) {
      if (response.status === 429) {
        return json(res, 429, {
          error: 'search_rate_limited'
        });
      }

      if ([432, 433].includes(response.status)) {
        return json(res, 429, {
          error: 'search_credit_limit'
        });
      }

      if (response.status === 401 || response.status === 403) {
        return json(res, 502, {
          error: 'search_auth_error'
        });
      }

      console.error('[LILY] Erro Tavily:', response.status);

      return json(res, 502, {
        error: 'search_upstream_error'
      });
    }

    const data = await response.json();

    // Organiza os resultados encontrados
    const sources = (Array.isArray(data.results) ? data.results : [])
      .slice(0, 5)
      .map((item, index) => {
        const url = clean(item.url, 1000);

        let parsedUrl;

        try {
          parsedUrl = new URL(url);
        } catch {
          return null;
        }

        if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
          return null;
        }

        const title = clean(item.title || parsedUrl.hostname, 180);
        const content = clean(item.content, 2500);

        if (!content) return null;

        const publishedDate = clean(
          item.published_date || '',
          100
        );

        return {
          number: index + 1,
          title,
          url,
          hostname: parsedUrl.hostname,
          age: publishedDate,
          content
        };
      })
      .filter(Boolean);

    if (!sources.length) {
      return json(res, 200, {
        query,
        sources: [],
        context: '',
        retrievedAt: new Date().toISOString()
      });
    }

    // Prepara o conteúdo para a inteligência artificial
    const context = sources
      .map(source => (
        `[${source.number}] ${source.title}\n` +
        `URL: ${source.url}\n` +
        `Data de publicação: ${source.age || 'não informada'}\n` +
        `Conteúdo: ${source.content}`
      ))
      .join('\n\n');

    return json(res, 200, {
      query,
      retrievedAt: new Date().toISOString(),
      sources: sources.map(({ content, ...source }) => source),
      context,
      usage: data.usage?.credits ?? null
    });

  } catch (error) {
    if (error.name === 'AbortError') {
      return json(res, 504, { error: 'search_timeout' });
    }

    console.error('[LILY] Falha na pesquisa:', error.name);

    return json(res, 502, {
      error: 'search_network_error'
    });

  } finally {
    clearTimeout(timeout);
  }
}
