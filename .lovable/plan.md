## Objetivo

Simplificar o detalhe do cliente (`ClientDossier`) para virar um dossiê objetivo: header, 4 cards principais grandes, resumo compacto e 6 abas. Sem mexer em nada fora do dossiê do cliente.

## Escopo

Arquivo único a alterar: `src/components/client-dossier.tsx`.
- Nenhuma mudança em rotas, schema, RLS, views (`v_client_financial_summary` permanece como está), bancos, dashboard, financeiro global, recorrências globais, aportes globais, configurações, auth.
- Nenhuma migração SQL.

## Mudanças

### 1. Header (manter)
Manter o `<header className="client-header">` como está hoje (logo, nome, PF/PJ, documento, empresa, telefone, e-mail, badges de status e botão Editar). Sem alterações visuais.

### 2. 4 Cards principais (substituir `MetricsGrid`)
Substituir a `MetricsGrid` atual (3 fileiras de 4 cards + botão "Ver todas") por um único grid com **4 cards grandes**:

| Card | Origem (do `summary` da view) |
|---|---|
| Já pagou | `total_received` |
| A pagar | `total_receivable` |
| Em atraso | `total_overdue` |
| Saldo de aporte | `repasse_balance` |

Layout: `grid grid-cols-2 md:grid-cols-4 gap-3`, cards maiores (mesmo estilo glass, com ícone, label e valor em destaque, tons: success / default / destructive / primary).

### 3. Bloco "Resumo do cliente" (novo, compacto)
Logo abaixo dos 4 cards, um único bloco `glass rounded-2xl` com título "Resumo do cliente" e uma lista compacta (grid 1 col mobile / 2 cols md) de linhas `label: valor`:

- Mensalidade ativa → `summary.active_recurring_amount` (ou "Nenhum registro")
- Próximo vencimento → menor `next_due_date` de `recurring` ativas
- Previsto no mês → `summary.expected_recurring_month`
- Última movimentação → última `tx` por `created_at` (descrição + data)
- Último pagamento → última `tx` paga (`paid_at` mais recente, qualquer tipo "pago")
- Status financeiro → badge `FinancialStatusBadge`

Sem cards individuais grandes — apenas linhas com label `text-muted-foreground` e valor em destaque.

### 4. Abas (reduzir de 8 para 6)
Trocar a `TabsList` para apenas:
1. Visão geral
2. Financeiro
3. Aportes
4. Arquivos
5. Timeline
6. Observações

Remover as abas "Mensalidades" e "Planos/Ferramentas". O componente `MensalidadesTab` e `PlanosTab` ficam no arquivo mas não são mais renderizados como aba de primeiro nível (mantidos no código por enquanto, podem ser excluídos numa próxima etapa para evitar mexer em lógica de mutação de recorrências aqui).

### 5. Aba "Visão geral" (simplificar)
Reaproveitar `OverviewTab` reduzindo a:
- Bloco "Próximos vencimentos" (mantém atual, top 5)
- Bloco "Últimas movimentações" (mantém atual, top 5)
- Bloco "Mensalidades ativas" (lista compacta das `recurring` com `status='ativo'`, só se houver)
- Alerta de inadimplência se aplicável

Não repetir os 4 cards principais nem o "Resumo do cliente" dentro da aba.

### 6. Aba "Financeiro" (manter)
`FinanceiroTab` existente já cobre o requisito (lista com filtros de período/tipo/status/banco). Nenhuma mudança.

### 7. Aba "Aportes" (ajuste leve)
`AportesTab` existente já mostra Total aportado / utilizado / saldo + histórico por plataforma. Manter como está; só garantir que os 3 indicadores do topo apareçam compactos (já é o caso).

### 8. Aba "Arquivos" (manter)
`ArquivosTab` existente atende — bucket `client-documents`, URLs assinadas, tipos de documento listados. Nenhuma mudança.

### 9. Aba "Timeline" (manter)
`TimelineTab` existente já agrega no frontend (tx + recurring + docs + criação). Nenhuma mudança.

### 10. Aba "Observações" (manter)
`ObservacoesTab` existente atende. Nenhuma mudança.

### 11. Mobile
- 4 cards principais em grid 2x2 (já natural com `grid-cols-2 md:grid-cols-4`).
- Resumo do cliente em 1 coluna.
- `TabsList` continua com scroll horizontal (`overflow-x-auto`).

## Fora de escopo

- Não criar nova tabela/timeline persistida.
- Não mexer em `v_client_financial_summary`, `financial_transactions`, `recurring_contracts`, `third_party_plans`, `client_documents`.
- Não tocar em sidebar, install PWA, login, dashboard, financeiro/recorrências/aportes/bancos/configurações globais.
- Não remover (ainda) os componentes `MensalidadesTab` e `PlanosTab` do arquivo — apenas deixá-los sem trigger na `TabsList`. Limpeza pode ser uma etapa futura.

## Arquivos afetados

- `src/components/client-dossier.tsx` — substituir `MetricsGrid` pelos 4 cards, adicionar bloco "Resumo do cliente", reduzir `TabsList` para 6 abas, simplificar `OverviewTab`.
