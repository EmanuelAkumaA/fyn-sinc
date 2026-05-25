# Correção do Dossiê do Serviço

Escopo restrito ao módulo Serviços (view `v_service_summary` + componente `ServiceDossier`). Nada mais é alterado.

## 1. Atualizar a view `v_service_summary`

Migration nova que substitui a view para que a classificação Ativo/Inativo passe a depender de `clients.client_status`, não do status da recorrência.

- `all_clients`: clientes distintos com histórico no `service_id` (via `financial_transactions` OU `recurring_contracts`), já filtrado por `organization_id` igual ao do serviço.
- `active_clients_count`: `COUNT(DISTINCT client_id)` entre `all_clients` onde `clients.client_status = 'ativo'`.
- `inactive_clients_count`: idem com `client_status = 'inativo'`.
- `total_clients_count`: `COUNT(DISTINCT client_id)` de `all_clients` (independe do status do cliente).
- Receita, ticket médio, em atraso, pendente, MRR, contagem de recorrências ativas: mantidos como hoje.
- View continua `security_invoker = true` (respeita RLS, portanto `organization_id`).

## 2. Ajustar `src/components/service-dossier.tsx`

### 2.1 Classificação dos clientes (frontend)
Hoje "ativo/inativo" usa presença de recorrência ativa. Trocar para usar `clients.client_status`:

- `clientIds`: união de `client_id` de `allTx` + `recurring` (mantém).
- Buscar `clients` (já traz `client_status`).
- `activeClientIds` = clientes com histórico **e** `client_status === 'ativo'`.
- `inactiveClientIds` = clientes com histórico **e** `client_status === 'inativo'`.
- Clientes sem histórico no `service_id` não entram (já garantido — só entram via `allTx`/`recurring`).
- Recorrência ativa vira informação adicional (chip "Recorrência ativa") na linha do cliente ativo, mas não define a aba.

### 2.2 Remover abas Financeiro e Recorrências
- Remover `<TabsTrigger value="financeiro">` e `<TabsTrigger value="recurring">` e seus respectivos `<TabsContent>`.
- Remover funções `FinanceiroTab` e o bloco de listagem de recorrências (e ícones/imports que ficarem órfãos: `PauseCircle`, `PlayCircle`, `Zap`, etc.).
- Manter mutations `generateNext` e `toggleRecStatus`? **Remover** — não são mais usadas no modal.
- Abas finais: **Visão geral · Clientes ativos · Clientes inativos · Timeline**.

### 2.3 Visão geral
- Manter os MetricCards atuais (Clientes ativos, Já compraram, Receita, MRR/Avulsos pendentes, Ticket médio, Inadimplência) — já cobre o pedido.
- Métrica "Já compraram" passa a exibir hint com `inactiveClientsCount` vindo da view corrigida.
- Mantém "Últimas vendas" e "Próximos vencimentos".

### 2.4 Cliente ativo (linha)
- Logo, nome, badge financeira (`financial_status`).
- Última movimentação com o serviço (data + valor) — derivada de `allTx` ordenada por `paid_at`/`due_date`.
- Se tiver recorrência ativa: chip pequeno "Recorrência ativa · {valor} · {frequência}".
- Ações: abrir cliente, novo lançamento (`goNewTx`), nova recorrência (`goNewRec`, opcional).

### 2.5 Cliente inativo (linha)
- Logo, nome, badge financeira.
- Última movimentação com o serviço (data + valor pago ou pendente).
- Texto "Inativo no cadastro".
- Ações: abrir cliente, novo lançamento, nova recorrência.
- (Reativar cliente fica como ação futura — só seria possível alterando o cadastro do cliente, fora do escopo deste modal.)

### 2.6 Timeline
- Mantém a agregação atual (criação do serviço, lançamentos, pagamentos, recorrências criadas), ordem desc.

## 3. Cache / contadores do card da listagem
A página `servicos.tsx` lê de `v_service_summary` — assim que a view for atualizada, os chips do card (`Ativos`, `Já compraram`, `Receita`, etc.) ficam coerentes automaticamente. Nenhuma mudança adicional necessária em `servicos.tsx`.

## 4. Segurança / organization_id
- View segue `security_invoker = true` → RLS de `services`, `financial_transactions`, `recurring_contracts`, `clients` aplicam.
- Queries do componente já filtram por `service_id` e dependem de RLS por org (sem cross-org). Sem mudanças necessárias.

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — substitui `v_service_summary` com nova lógica baseada em `clients.client_status`.
- `src/components/service-dossier.tsx` — nova lógica de classificação, remoção das abas Financeiro/Recorrências, ajustes de linhas.
- Regenerar `src/integrations/supabase/types.ts` ocorre automaticamente após a migration.

## O que NÃO é alterado
Dashboard, Clientes, Financeiro, Bancos, Calendário, Recorrências (página), regras financeiras globais, página `servicos.tsx` (exceto consumo automático da view atualizada).
