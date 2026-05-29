## Calendário: sempre exibir na data de vencimento

**Problema:** hoje no calendário, quando uma transação é marcada como paga, ela "pula" da data de vencimento para a data de pagamento (`paid_at`), confundindo a visão mensal.

**Mudança:** o calendário passa a posicionar TODA transação pela `due_date` (vencimento), independente de status. A `paid_at` continua existindo no banco e aparece no detalhe do dia ("Pago em dd/mm/yyyy") — só não move mais o card no grid.

### Arquivo

- `src/components/financial-calendar.tsx`

### Alterações

1. **`dayKey(t)`** — substituir:
   ```ts
   if (t.status === "pago") return t.paid_at;
   return t.due_date;
   ```
   por:
   ```ts
   return t.due_date;
   ```
   (cai de volta em `due_date` para todos os casos; transações sem `due_date` continuam sendo descartadas, como hoje)

2. **Resumo do mês (`summary`)** — manter como está. "Recebido no mês" continua somando por `paid_at` dentro do mês (faz sentido como caixa); "Previsto / a receber / em atraso" já usam `due_date`.

3. **Agrupamento `byDay`** — não muda (usa `dayKey`, que agora sempre devolve `due_date`).

4. **Drawer do dia (`DayDetails`)** — sem mudanças: já mostra "Pago em {paid_at}" quando `status === 'pago'` e "Vence {due_date}" caso contrário.

### Fora de escopo

- Não altera `paid_at` nos dados existentes (a data de pagamento continua registrada, só não desloca o card).
- Não muda Financeiro, Dashboard, Aportes nem mutations de pagamento.
- Não altera o resumo "Recebido no mês" (continua baseado em `paid_at`, que é o correto para fluxo de caixa).
