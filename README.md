# LILY — PWA com IA (Groq + Vercel)

## Variáveis de ambiente (só no servidor)
| Nome | Obrigatória | Para quê |
|---|---|---|
| `GROQ_API_KEY` | sim | chave da Groq (console.groq.com/keys) |
| `GROQ_MODEL` | não | padrão `openai/gpt-oss-120b`; alternativas: `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` |
| `LILY_ACCESS_CODE` | sim | código que a Evellin digita uma vez em Minha LILY. Sem ele, a API recusa tudo |
| `RATE_PER_MIN` / `RATE_PER_DAY` | não | limites por IP (padrão 12 e 300) |
| `ALLOWED_ORIGINS` | não | outras origens permitidas (padrão: só o próprio site) |

## Rodar localmente
    cp .env.example .env.local    # preencha GROQ_API_KEY e LILY_ACCESS_CODE
    node dev-server.mjs           # http://localhost:3000 (ou use `npx vercel dev`)
    npm test                      # testes automáticos (Groq simulado)

## Publicar na Vercel
1. Envie o projeto para um repositório (o `.gitignore` já exclui `.env*`) e importe na Vercel. Framework: "Other".
2. Em Settings → Environment Variables, cadastre `GROQ_API_KEY`, `GROQ_MODEL` e `LILY_ACCESS_CODE`, e faça um novo deploy.
3. Abra o endereço no celular, vá em Minha LILY, digite o código e toque em "Salvar e testar".

Ao alterar arquivos do frontend, aumente `VERSION` em `public/sw.js`.
