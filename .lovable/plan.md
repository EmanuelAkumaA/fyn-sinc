
# Plano: Deploy do Fyn Sinc na Hostinger (Node.js App)

## Diagnóstico

O build atual está gerando saída para Vercel porque o Nitro está configurado com `preset: "vercel"` em `vite.config.ts`. Isso produz `.vercel/output/...`, que a Hostinger não reconhece. Para Hostinger Node.js, precisamos do preset `node-server` do Nitro, que gera `.output/server/index.mjs` — um servidor Node.js standalone pronto para `node .output/server/index.mjs`.

Nada precisa mudar em lógica, rotas, layout ou banco. Apenas configuração de build/start.

---

## 1. Mudanças no código

### `vite.config.ts`
Trocar o preset do Nitro para permitir alternar entre Vercel e Node via variável de ambiente, mantendo Node como padrão (que é o que a Hostinger precisa). Vercel continua funcionando se você setar `NITRO_PRESET=vercel` nas envs da Vercel.

```ts
nitro({ preset: process.env.NITRO_PRESET ?? "node-server" }),
```

### `package.json` — scripts
Adicionar `start` e tornar o `build` explícito quanto ao preset Node:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "start": "node .output/server/index.mjs",
  "preview": "vite preview",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

O Nitro com preset `node-server` já respeita `process.env.PORT` automaticamente — não precisa de flag adicional. Fallback default do Nitro é 3000 quando `PORT` não está setado, então a porta da Hostinger será usada corretamente.

### `vercel.json`
Manter o arquivo, mas adicionar `NITRO_PRESET=vercel` como env de build nas configurações do projeto Vercel (no painel da Vercel, não no arquivo) — assim a Vercel continua gerando `.vercel/output` e a Hostinger gera `.output`. Sem alterações necessárias no arquivo em si.

---

## 2. Configuração na Hostinger (Node.js App)

| Campo | Valor |
|---|---|
| Node.js version | 20.x (LTS, compatível com Vite 7 / React 19) |
| Application root | raiz do projeto |
| Application URL | seu domínio |
| Application startup file | `.output/server/index.mjs` |
| Install command | `npm install` (ou `bun install` se a Hostinger suportar) |
| Build command | `npm run build` |
| Start command | `npm run start` (equivalente a `node .output/server/index.mjs`) |
| Output directory | não se aplica para Node SSR — a Hostinger executa o startup file, não serve uma pasta estática. Se o painel exigir, aponte para `.output/public` (assets estáticos), mas o servidor Node serve isso por dentro. |

---

## 3. Variáveis de ambiente na Hostinger

Configurar no painel "Environment variables" do Node.js App:

**Públicas (frontend, embutidas no bundle):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Servidor (runtime):**
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (somente se já está em uso por server functions — nunca expor no frontend)
- Qualquer outra secret usada por `createServerFn` (`LOVABLE_API_KEY`, webhook secrets, etc.)

Importante: variáveis `VITE_*` precisam estar setadas **antes** do `build`, porque o Vite as inlinea no bundle no momento da build.

---

## 4. Rotas e SSR

Com preset `node-server`, o servidor Nitro responde a todas as rotas do TanStack Start (incluindo `/login`, `/dashboard`, `/clientes`, `/financeiro`, `/recorrencias`, `/aportes`) com SSR + fallback de SPA. Não precisa de regra de rewrite extra — acesso direto a URL profunda funciona.

---

## 5. Vercel continua conectada?

Sim, sem conflito. A condição é setar `NITRO_PRESET=vercel` no painel da Vercel (Environment Variables → Build). Isso faz a Vercel gerar `.vercel/output` como hoje, enquanto a Hostinger (sem essa env) usa o default `node-server` e gera `.output`.

---

## Resumo do que muda

1. `vite.config.ts`: preset Nitro passa a ser dinâmico, default `node-server`.
2. `package.json`: adiciona script `start` apontando para `.output/server/index.mjs`.
3. `vercel.json`: inalterado; Vercel passa a depender de uma env var de build (`NITRO_PRESET=vercel`) configurada no painel.
4. Hostinger: configurar Node 20, build `npm run build`, start `npm run start`, startup file `.output/server/index.mjs`, mais as envs listadas acima.

Nada na lógica financeira, layout ou banco é tocado.
