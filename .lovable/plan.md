
## Parte 1 — PWA instalável (sem service worker)

Boa parte já está pronta: `public/manifest.webmanifest`, ícones 192/512, `<link rel="manifest">` e meta tags Apple no `__root.tsx`. Faltam ajustes finos.

### 1.1 Ajustar `public/manifest.webmanifest`
- Adicionar `"scope": "/"`.
- Trocar `"start_url": "/"` por `"start_url": "/login"` (alinhado ao pedido).
- Trocar `"orientation": "portrait"` por `"portrait-primary"`.
- Atualizar `description` para "Sistema financeiro operacional para empresas de serviço."
- Manter `name`, `short_name`, cores `#0D1B2A`, `display: standalone` e ícones existentes (já `purpose: "any maskable"`).

### 1.2 `__root.tsx` (meta tags)
Já tem `theme-color`, `apple-mobile-web-app-capable`, `status-bar-style` e `app-title`. Nada a adicionar — apenas validar que `viewport-fit=cover` continua presente (está).

### 1.3 Não fazer nesta etapa
- Nenhum service worker, `vite-plugin-pwa`, cache offline ou prompt de instalação custom.
- Sem alterações em build/Vite.

### 1.4 Polimentos mobile (genéricos)
- Garantir que o `Dialog` do dossiê use `w-screen h-[100dvh] max-w-none rounded-none` em telas `< md`, e `max-w-6xl w-[95vw] max-h-[92vh]` em `md+`.
- Confirmar `safe-area-inset` na `MobileBottomNav` (padding-bottom env(safe-area-inset-bottom)).
- TabsList do dossiê: já tem `overflow-x-auto`; adicionar `whitespace-nowrap` nos triggers e remover `justify-start` se atrapalhar scroll horizontal no mobile.

## Parte 2 — Refinar dossiê do cliente

Base já existe em `src/components/client-dossier.tsx` com header, 13 métricas, 8 abas e view `v_client_financial_summary`. As mudanças são organização visual e UX, sem tocar em regras financeiras nem na view.

### 2.1 Reorganizar grid de métricas (`MetricsGrid`)
Mudar de uma grade plana de 13 cards para 3 linhas semânticas com 4 cards cada (último grupo = 4: Saldo de repasse, Repasses recebidos, Repasses utilizados, Comissões+Cashbacks combinados em 1 card ou manter 4 separados — manter os 4 separados, totalizando 12 + Lucro líquido na primeira linha).

Layout final:
- **Linha 1 (principais)**: Total recebido · A receber · Em atraso · Lucro líquido
- **Linha 2 (operacional)**: Mensalidade ativa · Recorrência prevista no mês · Avulsos pendentes · Taxas pagas
- **Linha 3 (repasses & ganhos)**: Saldo de repasse · Repasses recebidos · Repasses utilizados · Comissões + Cashbacks (mostrar dois valores empilhados no mesmo card)

Mobile: mostrar só a Linha 1 (4 cards principais) por padrão, com botão "Ver todas as métricas" expandindo Linhas 2 e 3. Desktop: todas visíveis.

Implementação: três `<div className="grid grid-cols-2 md:grid-cols-4 gap-3">` em sequência + estado `showAll` controlando visibilidade das linhas 2 e 3 em telas `< md`.

### 2.2 Modal grande → fullscreen no mobile
Em `src/routes/_app/clientes.tsx`, ajustar o `DialogContent` para:
- Mobile (`<md`): `w-screen h-[100dvh] max-w-none max-h-none rounded-none p-4 overflow-y-auto`.
- Desktop (`md+`): manter `max-w-6xl w-[95vw] max-h-[92vh] p-6`.

Header do dossiê: stack vertical com logo+nome em cima, contato no meio e status+botão Editar embaixo no mobile (já está com `flex-col md:flex-row` — só validar).

### 2.3 Aba Visão geral
Pequenos refinos:
- Adicionar 4º card "Resumo rápido" com: total cliente desde cadastro, ticket médio recebido, mensalidade total, dias desde último pagamento.
- Manter os cards existentes (Próximos vencimentos, Últimas movimentações, Mensalidades ativas).
- Banner de inadimplência já existe acima das métricas — manter.

### 2.4 Aba Arquivos
Validar (sem reescrever) que:
- Upload usa `client-documents/{organization_id}/{client_id}/{filename}`.
- Visualização usa `createSignedUrl` (não `getPublicUrl`).
- Insert do `client_documents` carrega `client_id` correto, sem criar novo cliente.

Se algum item acima estiver divergente, corrigir pontualmente.

### 2.5 Aba Timeline
Já é agregada no frontend a partir de `tx`, `recurring`, `docs` + `client.created_at`. Validar ordenação desc e ícones por tipo. Sem mudanças de schema.

### 2.6 Atualização dinâmica
`invalidateClientCaches` já cobre `clients`, `client`, `client-summary`, `client-transactions`, `client-documents`, `client-recurring`, `client-plans`, `client-timeline`, `dashboard`, `transactions`, `recorrencias`, `plans`.

Adicionar chave `wallet` (mencionada no pedido) na função.

### 2.7 NÃO mexer
- View `v_client_financial_summary` (já está pronta com os 14 campos pedidos).
- Regras de receita/despesa/repasse/comissão/cashback/taxa.
- Storage bucket `client-documents` (já privado).
- RLS (já filtra por `organization_id`).
- Módulos Admin, assinaturas, trial, painel público.

## Arquivos afetados

- `public/manifest.webmanifest` — ajustar campos.
- `src/components/client-dossier.tsx` — reorganizar `MetricsGrid` em 3 linhas + toggle mobile; adicionar card "Resumo rápido" no Overview; pequenos ajustes mobile nas TabsList.
- `src/routes/_app/clientes.tsx` — `DialogContent` responsivo (fullscreen mobile).
- `src/lib/client-cache.ts` — incluir chave `wallet`.

## Fora de escopo
- Service worker / offline / cache avançado.
- Mudanças em rotas, schema, RLS, view, storage.
- Outros módulos do produto.
