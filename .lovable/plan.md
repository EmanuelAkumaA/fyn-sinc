## Problema

O deploy na Vercel está falhando com:

> Erro: Nenhum diretório de saída chamado "output" foi encontrado após a conclusão da compilação.

Causa: o `vite.config.ts` usa o preset Nitro `node-server` por padrão, que gera `.output/server/` (formato Node). A Vercel espera o formato `.vercel/output/` (Build Output API), que só é produzido quando o Nitro roda com o preset `vercel`.

Como a Hostinger será um VPS Node.js, ela continua usando o build atual (`.output/` + `node .output/server/index.mjs`). Precisamos apenas que a Vercel use um preset diferente.

## Plano

### 1. Vercel — usar o preset Nitro `vercel`

Editar `vercel.json` para injetar a variável de ambiente no build:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "NITRO_PRESET=vercel bun run build",
  "outputDirectory": ".vercel/output"
}
```

Mudanças:
- `framework: null` — desliga a auto-detecção da Vercel (que estava forçando o template TanStack Start e procurando o caminho errado).
- `buildCommand` passa `NITRO_PRESET=vercel`, fazendo o `nitro/vite` gerar `.vercel/output/` no formato Build Output API que a Vercel entende nativamente.
- `outputDirectory` confirma o caminho.

Nenhuma outra mudança no `vite.config.ts` é necessária — ele já lê `process.env.NITRO_PRESET ?? "node-server"`.

### 2. Hostinger (VPS Node.js)

O build padrão (`bun run build` sem `NITRO_PRESET`) já produz `.output/server/index.mjs`, que é exatamente o que o `npm start` (script já existente) executa.

Passos no VPS (sem mudança de código):
1. `git clone` do repositório
2. `bun install` (ou `npm install`)
3. `bun run build`
4. Configurar variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` etc.)
5. `npm start` (ou usar PM2: `pm2 start "npm start" --name fyn-sinc`)
6. Configurar Nginx como reverse proxy para a porta 3000

Posso adicionar um `ecosystem.config.cjs` (PM2) e um snippet de Nginx ao repositório se quiser — só me avisar.

### 3. Variáveis de ambiente na Vercel

Lembre de cadastrar no painel da Vercel (Settings → Environment Variables) os mesmos secrets que você usa hoje no Lovable Cloud: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, e quaisquer outras chaves usadas nas server functions.

## Arquivos alterados

- `vercel.json` — único arquivo modificado.