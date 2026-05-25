## Objetivo
Evoluir somente o módulo Serviços: enriquecer a listagem com métricas por serviço e criar um **Dossiê do Serviço** (modal/sheet em abas) inspirado no `client-dossier.tsx`, sem tocar em Dashboard, Clientes, Bancos, Calendário, Auth/RLS ou lógica financeira global.

## Mudanças

### 1. Banco — view `v_service_summary` (migration)
Criar view em `public` agregando por `service_id` + `organization_id`:
- `service_id`, `service_name`, `service_type`, `category`, `status`, `default_value`, `organization_id`
- `active_clients_count` — DISTINCT `client_id` de `recurring_contracts` com `status='ativo'` e `service_id = s.id`
- `total_clients_count` — DISTINCT `client_id` de `financial_transactions` ∪ `recurring_contracts` por `service_id`
- `inactive_clients_count` = total − active
- `total_revenue` — SUM `amount_gross` de `financial_transactions` com `type='receita_propria'`, `status='pago'`, `service_id = s.id`
- `paid_transactions_count` — COUNT das mesmas
- `average_ticket` = total_revenue / NULLIF(paid_transactions_count,0)
- `overdue_amount` — SUM pendentes com `due_date < CURRENT_DATE`
- `pending_amount` — SUM pendentes (todas)
- `active_recurring_count` — COUNT recorrências ativas
- `active_mrr` — SUM(`amount` * fator por `frequency`: semanal=4, quinzenal=2, mensal=1, bimestral=1/2, trimestral=1/3, semestral=1/6, anual=1/12) das recorrências ativas

RLS: criar a view com `security_invoker=true` para herdar políticas das tabelas base (organização já filtrada por `is_org_member`). Não usar service role.

Regenerar `src/integrations/supabase/types.ts` após a migration (automático).

### 2. `src/routes/_app/servicos.tsx` — listagem enriquecida
- Trocar a query de `services` por `v_service_summary` (com fallback caso a view falhe).
- Manter header, busca, botão "Novo serviço", Sheet de edição (sem mudar `ServiceForm`).
- Cards de métricas globais: manter os 3 atuais e acrescentar receita total agregada e MRR total agregado.
- Cada card de serviço passa a mostrar chips compactos: **Clientes ativos**, **Já compraram**, **Receita**, **MRR** (se `type='recorrente'`) ou **Avulsos pendentes** (se `type='avulso'`), **Ticket médio**.
- Esconder chip quando valor for 0/sem dado, com fallback discreto "Sem vendas vinculadas ainda" quando todos zerados.
- Card inteiro vira clicável → abre **`ServiceDossier`**. Botão Editar (lápis) continua isolado com `stopPropagation`.

### 3. Novo componente `src/components/service-dossier.tsx`
Sheet/modal fullscreen no mobile, grande no desktop. Estrutura espelhando `client-dossier.tsx` (mesmo padrão visual de tabs com scroll horizontal).

Props: `{ serviceId: string; open: boolean; onOpenChange }`.

**Header**: nome, badges (tipo, categoria, status), valor padrão, descrição, botão "Editar serviço" (reaproveita `ServiceForm` em sub-sheet), menu de ações rápidas ("Criar lançamento", "Criar recorrência" — abrem os fluxos existentes pré-preenchendo `service_id`).

**Filtro de período** (Hoje/Semana/Mês/Ano/Personalizado/Todo histórico) afetando Visão geral e Financeiro. Default: Mês atual no Financeiro, Todo histórico no resto. MRR e inadimplência sempre "status atual".

**Abas**:
1. **Visão geral** — 6 cards principais (Clientes ativos, Já compraram, Receita gerada, MRR ativo / Avulsos pendentes, Ticket médio, Inadimplência) + blocos: Últimas vendas (5), Próximos vencimentos (5), alerta de inadimplência.
2. **Clientes ativos** — query: `recurring_contracts` ativos por `service_id` agrupado por cliente + join com `clients`; mostra logo, nome, status financeiro, valor/freq, próximo vencimento, último pagamento. Ações: abrir cliente (navegar `/clientes/$id`), criar lançamento, criar recorrência.
3. **Clientes inativos** — DISTINCT clientes históricos − ativos atuais; mostra última compra, último valor, status. Ações: abrir cliente, nova cobrança, nova recorrência.
4. **Financeiro** — lista `financial_transactions` por `service_id` com filtros (período, status, tipo, cliente). Mobile: cards; desktop: tabela.
5. **Recorrências** — lista `recurring_contracts` por `service_id`. Ações: gerar transação, pausar/ativar, editar, abrir cliente (reaproveitar handlers de `recorrencias.tsx`).
6. **Timeline** — agregação no frontend: merge ordenado de transações, recorrências (criadas/pausadas), eventos derivados (cliente entrou/saiu do serviço). Sem nova tabela.

Estados vazios para cada aba com as mensagens especificadas.

### 4. Pré-preenchimento de `service_id`
- "Criar lançamento" do dossiê → abrir Sheet de novo lançamento do `financeiro.tsx` com `service_id` pré-selecionado (extrair a Sheet em prop `initialServiceId` ou navegar via state). Implementação mais simples: navegar para `/financeiro?service_id=...&new=1` e ler na página.
- "Criar recorrência" análogo para `/recorrencias?service_id=...&new=1`.

### 5. Cache
Adicionar chaves novas em React Query: `["service-summary"]`, `["service", id]`, `["service-clients", id, "active"|"inactive"]`, `["service-transactions", id, filters]`, `["service-recurring", id]`, `["service-timeline", id]`. Invalidar nas mutações já existentes que tocam `financial_transactions` ou `recurring_contracts` (adicionar essas chaves em `src/lib/finance.ts` e `src/lib/client-cache.ts` — única mudança em arquivos compartilhados, sem alterar lógica).

## Fora de escopo
- Dashboard, Clientes, Bancos, Calendário, Aportes, Auth/RLS, Configurações, Admin.
- Backfill de `service_id` em transações antigas (transações sem `service_id` simplesmente não entram nas métricas).
- Triggers de auditoria/timeline persistida (timeline é só agregação client-side).
- Novas colunas em tabelas existentes (a view cobre todas as métricas).

## Resultado esperado
Listagem de Serviços com métricas por card; clique abre Dossiê com 6 abas, filtros de período, ações rápidas que já vinculam `service_id`, tudo responsivo e respeitando RLS por organização.
