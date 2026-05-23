## Objetivo

No formulário de Recorrências, substituir os campos **Início** e **Próx. vencimento** por:
- **Data da 1ª mensalidade** (data inicial = data de vencimento da primeira parcela)
- **Quantidade de mensalidades** (nº inteiro > 0)

O botão **Zap (Gerar transação)** continua gerando uma a uma, mas para automaticamente quando atingir a quantidade definida. A data sempre respeita o **dia da 1ª mensalidade**, usando o **último dia do mês** quando o mês não tiver aquele dia (ex.: 31/01 → 28/02 → 31/03).

## Mudanças

### 1. Banco (migration)
Tabela `recurring_contracts`:
- Adicionar `installments_total integer` (nullable; null = sem limite, mantém comportamento atual para registros antigos)
- Adicionar `installments_generated integer not null default 0`
- Adicionar `anchor_day smallint` (1–31; dia "ideal" do vencimento; preenchido a partir da data da 1ª mensalidade)
- Backfill: para registros existentes, `anchor_day = extract(day from start_date)`, `installments_generated = nº de transactions já vinculadas via recurring_contract_id`.

Mantemos `start_date` e `next_due_date` (continuam alimentando o ciclo). O campo `next_due_date` deixa de ser editável no formulário — passa a ser calculado a partir da data da 1ª mensalidade.

### 2. Formulário (`src/routes/_app/recorrencias.tsx`)
Remover input "Próx. vencimento". Adicionar:
- **Data da 1ª mensalidade** (date, obrigatório) → grava em `start_date` e, no insert, também em `next_due_date`.
- **Quantidade de mensalidades** (number, ≥ 1, obrigatório) → grava em `installments_total`.

Ao salvar:
- `anchor_day = day(start_date)`
- Em criação: `next_due_date = start_date`, `installments_generated = 0`.
- Em edição: não mexer em `installments_generated`; recalcular `next_due_date` só se a data inicial for alterada e ainda não houver parcelas geradas.

### 3. Lógica do botão Zap (`generateTx` mutation)
- Bloquear se `installments_total != null && installments_generated >= installments_total` (toast: "Todas as mensalidades já foram geradas").
- Após inserir a transação:
  - `installments_generated += 1`
  - Se atingiu o total → `status = 'inativo'` (recorrência encerrada) e não recalcular próxima data.
  - Senão → calcular nova `next_due_date` via helper `nextAnchoredDate(current, frequency, anchor_day)` que avança o período e ajusta para o último dia do mês quando `anchor_day` não existir naquele mês.

### 4. Helper de data
Criar `nextAnchoredDate` em `src/lib/fynsinc.ts` (ou substituir `addPeriod` quando houver `anchor_day`):
```
nextAnchoredDate("2026-01-31", "mensal", 31) → "2026-02-28"
nextAnchoredDate("2026-02-28", "mensal", 31) → "2026-03-31"
```
Algoritmo: avança mês/semana conforme frequência; depois faz `min(anchor_day, último_dia_do_mês_resultante)`.

### 5. UI complementar
- No card da recorrência mostrar `Geradas: X/Y` quando `installments_total` definido.
- Esconder/desabilitar Zap quando concluída; manter Pausar/Editar/Excluir.
- MetricCard "Próximo vencimento" e "Contratos ativos" continuam funcionando sem alteração.

## Arquivos afetados
- Migration nova (adicionar 3 colunas + backfill)
- `src/routes/_app/recorrencias.tsx` (form + mutations + card)
- `src/lib/fynsinc.ts` (helper `nextAnchoredDate`)
- `src/integrations/supabase/types.ts` (regerado após migration)

## Fora de escopo
- Não cria todas as transações de uma vez (a opção escolhida foi "gerar uma a uma pelo botão Zap").
- Não altera o módulo Financeiro nem o Dashboard.
