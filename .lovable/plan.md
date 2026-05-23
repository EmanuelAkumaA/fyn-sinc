## Objetivo

Mostrar de forma clara, no Dashboard e na tela Bancos, **quanto do dinheiro nas contas é da Kuma, quanto é de clientes (aportes), quanto é cashback e quanto saiu em taxas**. Automatizar a criação de cashback em despesas. Garantir que taxas já lançadas continuem aparecendo certo.

Sem mexer em: Calendário Financeiro, navegação, auth, RLS, módulos de Clientes, recorrências, Aportes/Repasses e layout geral.

---

## 1. Camada de dados — nova view `v_bank_balance_breakdown`

Migration nova que cria a view (mantém `v_bank_balance` como está). Por banco e organização:

```text
organization_id, bank_id, bank_name, bank_type, initial_balance,
income_total           -- receita_propria paga
expense_total          -- despesa_propria paga
commission_total       -- comissao paga
cashback_total         -- cashback pago
fees_total             -- taxa paga
repasse_received_total -- repasse_recebido pago
repasse_used_total     -- uso_repasse pago
transfer_in_total      -- transferencia (destino = banco)
transfer_out_total     -- transferencia (origem = banco)
total_balance          -- initial + entradas - saídas + transferências
kuma_balance           -- income + commission + cashback - expense - fees
client_funds_balance   -- repasse_received - repasse_used
```

Regras:
- Transferências entram apenas no `total_balance`. Comentário SQL deixa claro que a "origem" da transferência (Kuma vs cliente) não é separada nesta etapa.
- A view é `SECURITY INVOKER` e filtra por `bank.organization_id`; RLS dos bancos/transações já garante isolamento por org.
- View substitui as queries paralelas que a tela Bancos faz hoje (`v_bank_balance` + `bank-client-balances` ad-hoc).

## 2. Dashboard — ajustes nos cards principais

Arquivo: `src/routes/_app/dashboard.tsx`. Calendário intocado. Ajustes apenas nos cálculos para alinhar à regra:

- **Receita própria** = `receita_propria` paga + `comissao` paga. Remove `cashback` deste card (vai para bloco novo).
- **Despesas** = `despesa_propria` paga + `taxa` paga. Subtítulo "incluindo taxas" mantém.
- **Lucro líquido** = receita_propria + comissao + cashback − despesa_propria − taxa.
- **A receber / Inadimplência / Saldo em bancos**: como hoje.
- **Saldo em bancos**: adicionar linha pequena `Kuma: R$ X • Aportes: R$ Y` somando `kuma_balance` e `client_funds_balance` da nova view.

## 3. Dashboard — bloco "Composição dos bancos"

Inserido **entre o Calendário e a seção Operacional**. 4 mini-cards (grid 4 col desktop / 2 tablet / 1 mobile), padrão visual `MetricCard` com tons:

1. **Kuma Tech líquido** — verde/branco
2. **Aportes / saldo de clientes** — ciano
3. **Cashbacks recebidos** — esmeralda
4. **Taxas pagas** — vermelho

Valores somados da nova view.

## 4. Dashboard — bloco "Contas e composição"

Logo abaixo, grid 2 colunas (1 no mobile), até 6 bancos ordenados por `total_balance` desc. Cada card:

```text
[logo] Nome do banco               Status
       Tipo da conta
       R$ 1.320,00                 (saldo total)
       [Kuma R$ 0] [Aportes R$ 1.320] [Cashback R$ 0] [Taxas -R$ 0]
```

- Chips zerados são **ocultos** no Dashboard.
- Botão "Ver todos os bancos" → `/bancos`.

## 5. Tela Bancos — chips padronizados

Arquivo: `src/routes/_app/bancos.tsx`. Substitui a query ad-hoc por `v_bank_balance_breakdown`. Em cada card mantém saldo total grande e adiciona **sempre os 4 chips** (Kuma / Aportes / Cashback / Taxas), mesmo zerados, para visão completa. Chips quebram linha no mobile.

Cards de topo (Saldo Consolidado / Contas Ativas / Saldo Inicial) ficam como estão.

## 6. Cashback automático em despesa

No formulário de novo lançamento (`NewTxForm` em `financeiro.tsx`), quando `type = despesa_propria`, mostrar bloco extra:

- Switch **"Essa despesa gerou cashback?"**
- Se ligado: valor do cashback, banco de destino, data, status (`recebido` → `pago` | `previsto` → `pendente`).

Comportamento:
- A despesa é salva normalmente.
- Em paralelo, é criada uma transação `type = cashback` com `parent_transaction_id` apontando para a despesa, `client_id` herdado, descrição `"Cashback de <descrição da despesa>"`, `paid_at` se recebido ou `due_date` se previsto.
- Helper único `upsertCashbackForExpense(expenseId, payload)` em `src/lib/finance.ts`: se já existir cashback com aquele `parent_transaction_id`, faz `update`; senão `insert`. Evita duplicidade quando o usuário reabrir/editar.
- Em invalidação de queries (`qc.invalidateQueries()`) já atinge dashboard/banks/transactions.

## 7. Taxas — manter funcionando

Fluxo atual em `pay-transaction-dialog.tsx` (criar `type = taxa` com `parent_transaction_id` ao confirmar pagamento com taxa) está correto. Ajustes:

- Trocar `insert` por `upsert` por `parent_transaction_id` para evitar duplicação ao remarcar pago (refatorar para usar helper `upsertFeeForReceipt`).
- Garantir `bank_id`, `client_id`, `paid_at`, `description = "Taxa <fornecedor> - <descrição>"` (já feito).
- Taxa já reduz saldo via `v_bank_balance` (que soma `taxa` como saída). Confirmar — se não somar, ajustar na nova view.

## 8. Invalidação global de cache

Centralizar em helper `invalidateFinanceCaches(qc)` que invalida:
`dashboard-*`, `banks`, `bank-balances`, `bank-breakdown`, `transactions`, `client-summary`, `wallet`. Chamado em todas as mutations relevantes (criar/editar/pagar/excluir).

## 9. Out of scope

- Reorganização do módulo Financeiro (lista atual continua).
- Calendário Financeiro (zero mudanças).
- Aportes/Repasses, Clientes, Recorrências, Planos.
- Separar origem (Kuma vs cliente) em transferências — anotado como TODO no comentário da view.

---

## Resumo técnico

**Arquivos novos/alterados:**
- `supabase/migrations/<timestamp>_bank_breakdown.sql` — cria `v_bank_balance_breakdown`.
- `src/lib/finance.ts` — helpers `upsertCashbackForExpense`, `upsertFeeForReceipt`, `invalidateFinanceCaches`.
- `src/routes/_app/dashboard.tsx` — ajuste cálculos, novos blocos Composição e Contas e composição.
- `src/routes/_app/bancos.tsx` — troca queries pela view, chips padronizados nos cards.
- `src/routes/_app/financeiro.tsx` — campo cashback no `NewTxForm` e uso do helper.
- `src/components/pay-transaction-dialog.tsx` — troca `insert` por `upsert` da taxa.
- Possíveis novos componentes: `BankBreakdownChips`, `BankCompositionCard` (em `src/components/`).

**Sem mudanças em:** `financial-calendar.tsx`, rotas de cliente/aporte/recorrência, layouts, RLS, server functions, integrações.
