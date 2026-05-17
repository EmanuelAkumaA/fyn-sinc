## Objetivo

Transformar `src/routes/_app/clientes.$id.tsx` em um dossiê completo do cliente (financeiro + operacional), mantendo o drawer de `clientes.tsx` apenas para edição cadastral. Métricas dinâmicas reagem a lançamentos em qualquer módulo via invalidação de queries.

## 1. Banco de dados (migrations)

**View `v_client_financial_summary`** — agrega por `organization_id` + `client_id`:
- `total_received` (receita_propria + comissao + cashback, status=pago)
- `total_receivable` (receita_propria pendente, due_date >= hoje)
- `total_overdue` (receita_propria pendente, due_date < hoje)
- `active_recurring_amount`, `expected_recurring_month`
- `pending_one_time_amount`
- `total_repasse_received`, `total_repasse_used`, `repasse_balance`
- `total_commissions`, `total_cashbacks`, `total_fees`
- `client_net_profit` = receita_propria + comissao + cashback − taxa − despesa_propria
- View herda RLS via `is_org_member(organization_id)` nas tabelas base.

**Tabela `client_documents`** — campos conforme spec; RLS por `is_org_member`; trigger `set_updated_at`.

**Tabela `client_timeline_events`** — campos conforme spec; RLS por `is_org_member`. Eventos automáticos via triggers em `clients`, `financial_transactions`, `recurring_contracts`, `client_documents`. Aba também concatena fontes existentes para retro-compatibilidade.

**Storage bucket `client-documents`** (privado) com policies:
- Path: `{organization_id}/{client_id}/{filename}`
- SELECT/INSERT/UPDATE/DELETE restritos a membros da org (validando `(storage.foldername(name))[1] = organization_id`).
- URLs assinadas para download.

## 2. Frontend — `src/routes/_app/clientes.$id.tsx`

Reescrever a página com:

**Header premium** (`ClientHeader`): logo + brand_color glow, nome, responsável, telefone, e-mail, documento, badges (status + financial_status), botão **Editar cliente** → abre drawer (reuso do componente `ClientForm` extraído).

**Grid de métricas dinâmicas** (`ClientMetricsGrid`): 13 cards consumindo `v_client_financial_summary` via `useQuery(['client-summary', clientId])`.

**Tabs (shadcn)**:
1. **Visão geral** — métricas-chave, próximos vencimentos, últimas movimentações, alerta de inadimplência, saldo de repasse, mensalidades ativas.
2. **Financeiro** — tabela/lista de `financial_transactions` com filtros (período, tipo, status, banco). Mobile: cards.
3. **Mensalidades** — `recurring_contracts` do cliente; ações gerar transação / editar / pausar.
4. **Aportes/Repasses** — cards (aportado, utilizado, saldo) + agrupamento por plataforma + lista.
5. **Planos/Ferramentas** — `third_party_plans`; estado vazio com CTA se não houver.
6. **Arquivos** — upload (drag/drop), título, tipo, descrição, data, vínculo opcional a transação; lista com visualizar / baixar (signed URL) / excluir.
7. **Timeline** — eventos cronológicos (mix de `client_timeline_events` + derivados).
8. **Observações** — campo `notes` editável inline.

## 3. Refatorações

- Extrair `ClientForm` de `clientes.tsx` para `src/components/client-form.tsx` para reuso pelo botão Editar no header.
- Criar componentes: `client-header.tsx`, `client-metrics-grid.tsx`, e `tabs/` para cada aba sob `src/components/client-detail/`.
- Hook `useClientSummary(clientId)`, `useClientDocuments`, `useClientTimeline`.

## 4. Invalidação de cache

Centralizar em `src/lib/client-cache.ts` um helper `invalidateClientCaches(qc, clientId)` que invalida:
`['client', id]`, `['client-summary', id]`, `['client-transactions', id]`, `['client-documents', id]`, `['client-timeline', id]`, `['clients']`, `['dashboard']`, `['transactions']`.

Chamar em todas as mutations de Financeiro, Recorrências, Aportes, Planos e Documentos que tenham `client_id`.

## 5. Design

Mantém tokens atuais (dark, Sora/Inter, primary petróleo). Header usa `--client-color` derivada de `brand_color` (padrão já existe em `clientes.$id.tsx`). Cards em `glass`, tabs com scroll horizontal no mobile, tabelas viram cards <md.

## 6. Segurança

- RLS em `client_documents`, `client_timeline_events` (org-scoped).
- Bucket privado + signed URLs.
- Path inclui `organization_id/client_id`.
- Sem alterações em outros módulos.

## Ordem de execução

1. Migration: view + tabelas + bucket + policies (1 chamada `supabase--migration`).
2. Extrair `ClientForm`.
3. Criar componentes do detalhe (header, métricas, cada aba).
4. Reescrever `clientes.$id.tsx` montando tudo.
5. Adicionar `invalidateClientCaches` e plugar nas mutations existentes dos outros módulos.

## Pontos a confirmar antes de implementar

1. **Bucket de Storage**: criar novo `client-documents` privado, ok?
2. **Triggers automáticos** de timeline: implementar agora via DB triggers, ou montar timeline só por agregação no frontend nesta etapa (mais simples, sem trigger)?
3. **Despesas vinculadas ao cliente**: a tabela `financial_transactions` tem `client_id` nullable — devo considerar `type='despesa_propria'` com `client_id` setado como despesa do cliente para o `client_net_profit`?
