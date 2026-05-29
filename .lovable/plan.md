## Despesas & Planejamento — V1

Nova aba autenticada que serve como **camada de planejamento** das despesas. O Financeiro continua sendo a fonte oficial dos lançamentos; aqui você cadastra, projeta e dispara o lançamento. A baixa permanece exclusiva no Financeiro e reflete de volta no planejamento via vínculo direto.

### O que NÃO muda
Calendário Financeiro, Clientes, Serviços, Aportes/Repasses, Auth/RLS, Admin, Trials, Assinaturas. Bancos e Dashboard só são afetados indiretamente quando a despesa é paga no Financeiro (fluxo já existente).

---

### 1. Banco de dados (1 migration)

**`expense_categories`**
- `id, organization_id, name, classification, status='ativo', timestamps`
- `classification`: `operacional | investimento | equipe | financeiro | infraestrutura | marketing | personalizado`
- Seed das 13 categorias padrão por organização (inserção via trigger no primeiro acesso ou ao criar a primeira despesa — não no `handle_new_user` para não afetar orgs existentes)

**`expense_plans`** (configuração da despesa)
- Campos conforme spec: `name, description, expense_type (fixa|variavel|investimento), category_id, amount, frequency (unica|semanal|quinzenal|mensal|bimestral|trimestral|semestral|anual), due_day, start_date, end_date, default_bank_id, client_id, service_id, status (ativo|pausado|cancelado), notes`
- (sem `default_credit_card_id` — não existe tabela de cartões; campo fora do escopo da V1)

**`expense_occurrences`** (cada competência)
- `expense_plan_id, financial_transaction_id, reference_month, description, amount, due_date, status (nao_lancada|lancada|paga|vencida|pausada|cancelada), launched_at, paid_at, bank_id, notes`
- **Unique constraint**: `(expense_plan_id, reference_month)` para prevenir duplicidade
- Trigger `set_updated_at` em todas

**`financial_transactions`**
- Adicionar coluna `expense_occurrence_id uuid null` (vínculo reverso)
- Trigger AFTER UPDATE em `financial_transactions`: quando `status` muda para `pago` e `expense_occurrence_id` está preenchido → atualizar a ocorrência (`status='paga', paid_at, bank_id`). Quando volta para `pendente` → ocorrência volta para `lancada`.

**RLS**: padrão do projeto — `is_org_member(organization_id) AND is_org_active(...)` para escrita, `is_org_member` para leitura, `is_super_admin` ALL. GRANTs para `authenticated` + `service_role`.

**Views**
- `v_expense_planning_summary` — agregados por org/mês (planejado, lançado, pago, pendente, vencido, equivalente fixo mensal, contagem assinaturas/investimentos)
- `v_expense_category_summary` — totais por categoria/mês
- (a "v_expense_occurrences" será resolvida com select+joins no client; view extra é opcional)

---

### 2. Frontend

**Nova rota**: `src/routes/_app/despesas-planejamento.tsx`

**Sidebar**: adicionar item "Despesas & Planejamento" com ícone `ClipboardList` (logo após Aportes/Repasses) em `src/components/app-sidebar.tsx` e também no `MobileBottomNav`.

**Estrutura da página** (segue padrão visual de `financeiro.tsx` e `aportes.tsx`):

1. **PageHeader** com subtítulo "Controle de custos fixos, variáveis e projeção de caixa." + botão "Nova despesa"
2. **Filtro de período** (Hoje/Semana/Mês/Ano/Custom — padrão Mês atual)
3. **Cards principais** (grid responsivo, `MetricCard`): Gastos fixos mensais, Planejado no mês, Já lançado, Já pago, Falta pagar, Saldo conservador, Saldo esperado
4. **Métricas secundárias** (em accordion/seções colapsáveis para não poluir):
   - Previsto x realizado (barra de progresso)
   - Despesas por categoria (ranking)
   - Próximos vencimentos (hoje / 7d / 15d)
   - Assinaturas ativas / Investimentos ativos / Top 5 despesas
5. **Tabs/filtros**: Todas | Fixas | Variáveis | Investimentos | Não lançadas | Lançadas | Pagas | Vencidas | Pausadas | Canceladas
6. **Lista de despesas** (cards): nome, categoria, tipo, frequência, valor, próximo vencimento, status, banco, cliente/serviço. Ações: Editar, Pausar/Ativar, Cancelar, Excluir, Lançar/Ver no Financeiro, Gerar próxima ocorrência
7. **Sheet "Nova despesa"** com todos os campos da spec, duas ações de salvar:
   - "Salvar no planejamento" → cria plan + occurrence atual (`nao_lancada`)
   - "Salvar e lançar no Financeiro" → também cria `financial_transaction` pendente vinculada
8. **Drawer de detalhe** ao clicar numa despesa: dados do plano + lista de ocorrências (competências) com status, total pago no ano, total previsto

**Mutations** (React Query):
- `createExpensePlan` (com flag `launch_now`)
- `updateExpensePlan`
- `deleteExpensePlan`
- `setPlanStatus` (pausar/ativar/cancelar)
- `launchOccurrence` — cria `financial_transaction` pendente (type `despesa_propria`, vincula `expense_occurrence_id`, copia categoria/cliente/serviço/banco), atualiza ocorrência
- `generateNextOccurrence` — calcula próximo `reference_month`/`due_date` baseado em `frequency` + `due_day`, insere respeitando unique constraint

**Invalidações**: além das de finanças (`invalidateFinanceCaches`), invalidar `expense-plans`, `expense-occurrences`, `expense-summary`, `expense-categories`.

**Cashback**: mantém o fluxo já existente — `upsertCashbackForExpense` em `src/lib/finance.ts` já cobre. Nada novo aqui; quando o usuário pagar a despesa no Financeiro, o `PayTransactionDialog` cuida do cashback.

**Validação**: Zod no formulário (amount > 0, due_day 1–31, frequency enum, start_date válido).

---

### 3. Geração de ocorrências (V1 simples)

- Ao criar o plano: cria 1 ocorrência (mês corrente se `start_date` <= hoje, senão `start_date`)
- Botão manual "Gerar próxima ocorrência" por plano
- Botão "Gerar lançamentos do mês" no topo: para cada plano ativo recorrente sem ocorrência no mês visualizado, cria
- Sem cron; sem geração automática infinita

---

### 4. Arquivos tocados

**Migration**: 1 nova em `supabase/migrations/`
**Novos**: `src/routes/_app/despesas-planejamento.tsx`, helpers em `src/lib/expenses.ts` (cálculos de frequência, próximo vencimento)
**Editados**: `src/components/app-sidebar.tsx` (item nav), `src/integrations/supabase/types.ts` (regenerado pós-migration)

---

### Fora do escopo (V1)
Cartão de crédito como entidade, cron de geração futura, conciliação bancária, notificações, alertas por e-mail/WhatsApp, orçamento por centro de custo, aprovações.
