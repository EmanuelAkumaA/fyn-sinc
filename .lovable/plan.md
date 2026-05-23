## Objetivo

Ao clicar no botão **Zap** de uma recorrência, abrir um diálogo perguntando se o usuário quer gerar **1 mensalidade** (comportamento atual) ou **gerar em massa** uma quantidade definida de mensalidades de uma vez.

## Mudanças

### 1. `src/routes/_app/recorrencias.tsx`

**Novo estado de UI**
- `zapTarget`: recorrência selecionada (abre o diálogo quando definida).
- `zapMode`: `"one" | "bulk"`.
- `zapQty`: número de parcelas a gerar quando modo = bulk.

**Novo diálogo (AlertDialog ou Dialog)** disparado pelo botão Zap:
- Mostra: cliente, descrição, próx. vencimento, geradas/total.
- Opção 1 (radio): **Gerar 1 mensalidade** (data = `next_due_date`).
- Opção 2 (radio): **Gerar em massa** — input numérico de quantidade.
  - Default: restante (`installments_total - installments_generated`) ou `1` se sem limite.
  - Máximo: restante (quando houver `installments_total`); sem limite hard quando `installments_total = null`, mas validar ≥ 1 e ≤ 60 para segurança.
- Botões: Cancelar / Confirmar.

**Refatorar `generateTx` para suportar lote**

Substituir a mutation atual por uma que aceita `{ contract, count }`:
1. Valida: `status === "ativo"` e, se `installments_total != null`, `generated + count <= installments_total`.
2. Itera `count` vezes a partir de `r.next_due_date`:
   - Para cada iteração, calcula `dueDate` (na 1ª = `next_due_date`, depois `nextAnchoredDate` do anterior).
   - Verifica duplicidade por `recurring_contract_id + due_date` (consulta única `in('due_date', dueDates)` antes do loop para eficiência); se algum já existir, aborta com mensagem.
   - Monta o array de inserts e faz **um único** `supabase.from("financial_transactions").insert(rows)`.
3. Atualiza o contrato uma única vez:
   - `installments_generated = generated + count`
   - Se atingiu o total → `status = "inativo"`, mantém `next_due_date` no último gerado.
   - Senão → `next_due_date = nextAnchoredDate(últimoGerado, frequency, anchor_day)`.
4. Toast: "1 mensalidade gerada" ou "N mensalidades geradas".
5. Invalida queries `recorrencias`, `transactions`, `dashboard`.

**Botão Zap**
- Continua desabilitado quando inativo ou total atingido.
- `onClick` agora abre o diálogo em vez de chamar a mutation direto.

### Sem mudanças
- Migração de banco (estrutura atual já suporta).
- `src/lib/fynsinc.ts` (usa `nextAnchoredDate` existente).
- Outras telas (Financeiro, Dashboard) — só consomem as transações geradas.

## Arquivo afetado
- `src/routes/_app/recorrencias.tsx` (único)

## Fora de escopo
- Gerar mensalidades pulando datas/manualmente escolhidas.
- Geração automática agendada (cron).
