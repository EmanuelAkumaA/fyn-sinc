## Objetivo
Ao criar/editar um `provider_assignment`, gerar automaticamente o cronograma de `provider_payables` com base em **frequência + data do primeiro vencimento + quantidade de lançamentos** (ou modo contínuo). As obrigações aparecem em Equipe & Prestadores e em Despesas & Planejamento como saída operacional **prevista** (não pagas, sem reduzir banco). Lançamento no Financeiro e baixa continuam exclusivos do Financeiro existente, sem duplicar `financial_transactions`.

## Mudanças no banco (migration única)

`provider_assignments` — adicionar:
- `first_due_date date`
- `installments_count integer` (>=1 quando `recurrence_mode='finite'`)
- `recurrence_mode text not null default 'finite'` (`finite` | `continuous`)
- `auto_generate_payables boolean not null default true`
- `launch_behavior text not null default 'planning_only'` (`planning_only` | `launch_first` | `launch_all`)
- `end_date` mantida para compatibilidade; passa a ser calculada do último `due_date`.

`provider_payables` — adicionar:
- `installment_number integer`
- `installments_total integer`
- Índice único parcial: `(provider_assignment_id, installment_number)` quando `installment_number is not null`.
- Continua usando guard atual por `(assignment_id, reference_month)` para casos mensais.

`expense_occurrences` — já possui `provider_payable_id`. Adicionar (somente se ainda não existirem):
- `source_type text` / `source_id uuid` (para origem `provider_payable`).

RLS já existente é reutilizada; sem novas policies.

## Helper de datas
Novo `addProviderPaymentPeriod(dateISO, frequency, installmentIndex)` em `src/lib/providers.ts`:
- `unica`: só índice 0
- `semanal`: +7d * i
- `quinzenal`: +15d * i
- `mensal/bimestral/trimestral/semestral/anual`: +N meses * i (preserva dia, com clamp de fim de mês)

## Geração do cronograma
Nova função `generateAssignmentSchedule(assignment)` em `src/lib/providers.ts`:
- Calcula array `[{installment_number, due_date, amount, description}]`.
- `amount` = `fixed_amount` ou `base_revenue * percentage/100` (base via `fetchAssignmentExpectedRevenue`).
- Descrição: `Pagamento operacional — {prestador} — {serviço} — {cliente} — Parcela X/Y`.
- `recurrence_mode='continuous'`: gera apenas a próxima ocorrência; botão "Gerar próxima" cria a seguinte.

Nova `persistAssignmentSchedule(assignmentId, schedule, launch_behavior)`:
1. Faz upsert de `provider_payables` por `(assignment_id, installment_number)` — idempotente, nunca duplica.
2. Atualiza `provider_assignments.end_date` com a última `due_date` (quando `finite`).
3. Conforme `launch_behavior`: `planning_only` para; `launch_first` chama `launchPayableInFinance` na primeira; `launch_all` itera em todas que ainda não têm `financial_transaction_id`.
4. Também espelha em `expense_occurrences` via vínculo `provider_payable_id` (não cria saída independente — função utilitária `mirrorPayableToPlanning` que faz upsert por `provider_payable_id`).

## Form de vínculo (`src/components/assignment-form.tsx`)
Remover input visual `end_date`. Novos campos:
- `frequency` (já existe) — opções completas (única → anual).
- `first_due_date` (date, obrigatório).
- `installments_count` (number, min 1) — escondido quando `recurrence_mode='continuous'`.
- Checkbox "Sem quantidade definida" → `recurrence_mode='continuous'`.
- Radio "Como deseja gerar os lançamentos?" → `launch_behavior`.

Validação Zod atualizada em `src/lib/providers.ts` (`assignmentSchema`):
- `installments_count >= 1` quando `finite`.
- `percentage` 0–100; valores não-negativos.
- `first_due_date` obrigatório.

### Prévia do cronograma (dentro do form)
Componente `<SchedulePreview>` em assignment-form:
- Mostra: quantidade, valor/lançamento, total previsto prestador, receita prevista, lucro previsto, margem %, primeiro e último vencimento.
- Lista compacta: 3 primeiras + 2 últimas, com "+ N lançamentos" no meio.
- Atualiza ao mudar qualquer campo relevante; usa helpers acima sem persistir.

## Edição de vínculo
Ao salvar edição:
- Recalcula cronograma.
- Ocorrências `paga` ou `lancada` (com `financial_transaction_id`) **não são alteradas nem removidas**.
- Ocorrências `nao_lancada` futuras excedentes (quando reduz `installments_count`) → `status='cancelada'`.
- Novas parcelas faltantes são inseridas via upsert.
- Diálogo de confirmação quando houver mudanças que afetam ocorrências já lançadas → oferece "atualizar somente próximas" / "cancelar futuras e gerar novo cronograma".

## Despesas & Planejamento (`src/routes/_app/despesas-planejamento.tsx`)
Listagem passa a unir `expense_occurrences` + `provider_payables` espelhados:
- Coluna Origem: "Prestador" quando `source_type='provider_payable'`.
- Mostra prestador, cliente, serviço, parcela X/Y, status.
- Botão "Lançar no Financeiro" chama `launchPayableInFinance`.
- Botão "Ver prestador" abre dossiê.
- Sem criar saídas independentes.

## Dossiê do Prestador (`src/components/provider-dossier.tsx`)
- Aba Pagamentos: filtros por período/status/cliente/serviço/vínculo; colunas descrição, cliente, serviço, parcela X/Y, vencimento, valor, status, ações (lançar / ver no financeiro).
- Cards: Total previsto, A pagar, Em atraso, Pago, Custo recorrente mensal.
- Aba Vínculos: colunas novas — quantidade, valor/lançamento, total previsto, primeiro/último vencimento, próxima obrigação.
- Card de lucro/margem previstos do vínculo selecionado.

## Lançamento e baixa no Financeiro
- `launchPayableInFinance` já existe e é idempotente (verifica `financial_transaction_id`). Mantida.
- Baixa permanece exclusiva no Financeiro. Trigger `sync_provider_payable_on_tx` já propaga status/paid_at/bank_id para `provider_payables`. Mantida; nada novo no fluxo de baixa.
- **Não** mexer em Dashboard, Calendário, Bancos, Auth, Aportes.

## Invalidação React Query
Após criar/editar vínculo, gerar cronograma ou lançar no Financeiro, invalidar:
`providers`, `provider-summary`, `provider-assignments`, `provider-payables`, `expense-planning`, `expense-occurrences`, `transactions`, `dashboard`, `banks`, `client-summary/{id}`, `service-summary/{id}`.

## Segurança
- Zod no form + revalidação no submit.
- `organization_id` derivado de `getCurrentOrgId()` em toda inserção.
- Nenhum uso de service role no frontend.
- Guards de duplicidade por `(assignment_id, installment_number)` e `(assignment_id, reference_month)`.

## Responsividade
`assignment-form` revisto: grid 2 colunas no desktop, 1 coluna no mobile; prévia em lista vertical; modal fullscreen no mobile (já é `Sheet`).

## Fora do escopo
- Dashboard visual, Calendário Financeiro, Bancos, Auth, regras de aportes.
- Qualquer ajuste em `currency-input` ou máscaras (já entregue).

## Arquivos afetados
- migration SQL nova
- `src/lib/providers.ts` (schema, helpers, geração, espelho)
- `src/components/assignment-form.tsx` (campos novos, prévia, remoção de end_date)
- `src/components/provider-dossier.tsx` (colunas, filtros, ações)
- `src/routes/_app/equipe-prestadores.tsx` (uso das novas colunas se necessário)
- `src/routes/_app/despesas-planejamento.tsx` (origem prestador + ação lançar)
