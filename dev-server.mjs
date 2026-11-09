// Servidor local sem Vercel CLI: serve public/ e as funções de api/. Uso: node dev-server.mjs
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

for (const f of ['.env.local', '.env']) if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !l.trim().startsWith('#') && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const routes = { '/api/chat': 'chat', '/api/status': 'status', '/api/search': 'search' };
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const port = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (routes[path]) return (await import(`./api/${routes[path]}.js`)).default(req, res);
  const file = join('public', normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, ''));
  if (!existsSync(file)) { res.statusCode = 404; return res.end('Não encontrado'); }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(port, () => console.log(`LILY em http://localhost:${port}`));
