## Objetivo

Refinar o detalhe do cliente (`ClientDossier`) com: 4 cards principais renomeados, filtro de período na Visão geral, comparação com período anterior e textos vazios mais claros. Sem voltar a aba para o estado "cheio de cards".

## Escopo

Arquivo único: `src/components/client-dossier.tsx`.
Sem mudanças em schema, RLS, views, dashboard, financeiro global, recorrências globais, aportes globais, bancos, configurações, auth, planos globais, admin, assinaturas.
Sem migrações SQL — toda a lógica de período e comparação é calculada no frontend a partir das queries existentes (`client-transactions`, `client-recurring`, `client-summary`).

## Mudanças

### 1. Renomear card principal
- "A pagar" → **"Total a receber"** (em `MainMetrics`). Mantém ícone, tom default (branco/ciano via `text-foreground`) e ordem: Já pagou · Total a receber · Em atraso · Saldo de aporte.
- Tons: success / default / destructive / primary (já como hoje).
- `MainMetrics` passa a receber também `periodTotals` (calculado no `OverviewTab`) para sobrescrever `total_received`, `total_receivable` e `total_overdue` quando houver filtro. `Saldo de aporte` continua vindo de `summary.repasse_balance` (posição acumulada).

### 2. Filtro de período (Visão geral)
Adicionar header na aba "Visão geral" com:
- `Select` de período: **Hoje · Semana · Mês · Ano · Todo o histórico · Personalizado**.
- Quando "Personalizado", mostrar 2 `Input type="date"` (início / fim).
- Padrão: **Mês atual**.
- Estado local no `ClienteDetalhe` (subir o estado pra cima de `MainMetrics`, porque os 4 cards e o `ClientSummaryBlock` também precisam reagir ao período).
  - `period: "today" | "week" | "month" | "year" | "all" | "custom"`
  - `customStart`, `customEnd` (string `yyyy-mm-dd`)
- Helpers em `src/lib/fynsinc.ts` (ou inline no arquivo) sem migração:
  - `getPeriodRange(period, customStart?, customEnd?) → { start: string|null, end: string|null }`
  - `getPreviousPeriod(start, end) → { start, end }` (mesma duração em dias; para "year"/"month"/"week"/"today" usa janela equivalente anterior)

### 3. Aplicar período aos 4 cards e ao Resumo
Calcular no frontend, a partir de `tx` e `recurring`, sem tocar na view `v_client_financial_summary`:

| Métrica | Regra |
|---|---|
| Já pagou | sum(`amount_gross`) onde `type ∈ {receita_propria, comissao, cashback}` e `status='pago'` e `paid_at ∈ [start,end]` |
| Total a receber | sum onde `type='receita_propria'`, `status='pendente'`, `due_date ∈ [start,end]` e `due_date >= hoje` |
| Em atraso | sum onde `type='receita_propria'`, `status='pendente'`, `due_date < hoje` e `due_date <= end` |
| Saldo de aporte | `summary.repasse_balance` (acumulado, ignora período) |

Para período = "all": ignora filtro de data nas três primeiras (mantém regra de `status` e tipo); cai pros valores da view se preferir, mas mantém cálculo local para consistência.

### 4. Resumo do cliente (textos vazios + período)
Atualizar `ClientSummaryBlock`:
- "Previsto no mês" → **"Previsto no período"** (calcula sum `recurring.amount` ativas com `next_due_date ∈ [start,end]`; quando período = "month", mantém `summary.expected_recurring_month`).
- Textos vazios:
  - Mensalidade ativa → "Nenhuma mensalidade ativa"
  - Próximo vencimento → "Sem vencimentos neste período"
  - Previsto no período → "Sem previsão para o período"
  - Última movimentação → "Nenhuma movimentação no período" (filtrar `tx` por `created_at ∈ [start,end]`)
  - Último pagamento → "Nenhum pagamento registrado" (filtrar `paid_at ∈ [start,end]`)
- Última movimentação: `descrição — data` (já é, ajusta separador e label).
- Último pagamento: `R$ X em dd/mm/aaaa` (já é, ajusta texto).

### 5. Botão "Comparar período" + Drawer
Ao lado do filtro, botão `Comparar período` → abre `Sheet` (lateral em desktop, fullscreen em mobile).

Conteúdo do Sheet:
- Título: **Comparação de período**
- Subtítulo: `Período atual (dd/mm – dd/mm) vs anterior (dd/mm – dd/mm)`
- 4 cards comparativos (compactos, 2x2 em mobile, 4 colunas desktop):
  1. **Recebido** — receita_propria + comissao + cashback **pagos**
  2. **Lucro estimado** — Recebido − (taxas pagas) − (despesa_propria paga com client_id)
  3. **A receber** — receita_propria pendente futura no período
  4. **Em atraso** — receita_propria pendente vencida até fim do período
- Cada card: valor atual (grande), valor anterior (`text-muted-foreground` pequeno), Δ absoluto + %, ícone trend up/down/equal.
- Regras de cor:
  - Recebido/Lucro/A receber: ↑ verde, ↓ vermelho discreto, = neutro
  - Em atraso: ↑ vermelho, ↓ verde (inverter sinal de "bom")
- Gráfico simples (sem nova dependência): 3 pares de barras horizontais com `div` + `width:%` proporcional ao maior valor entre os dois períodos: Recebido, Lucro, Em atraso. Atual = cor sólida; Anterior = cor com 40% opacidade. Sem Recharts/D3.
- Linha secundária opcional ("Movimentação de aporte no período"): aportes recebidos (`type='repasse_recebido'`, paid_at no período) e utilizados (`type='uso_repasse'`, paid_at no período), apenas texto.

### 6. Visão geral mais limpa
Manter apenas, nessa ordem:
1. Header com filtro de período + botão Comparar
2. Próximos vencimentos (filtrar `due_date ∈ [hoje, end]`)
3. Últimas movimentações (filtrar `created_at ∈ [start,end]`)
4. Mensalidades ativas (só se houver)

Sem repetir 4 cards nem o Resumo dentro da aba (já estão acima das tabs).

### 7. Abas
Mantém as 6 atuais: Visão geral · Financeiro · Aportes · Arquivos · Timeline · Observações. Nenhuma mudança nas demais abas neste passo.

### 8. Responsividade
- Desktop: filtro + botão Comparar na mesma linha (`flex items-center gap-2`).
- Mobile: filtro full-width, botão Comparar abaixo (ou ao lado se couber em `sm:`).
- Sheet de comparação: `side="right"` desktop, `w-full` no mobile.
- 4 cards: já 2x2 mobile / 4 cols desktop.

### 9. Performance / Cache
- Sem novas queries: tudo deriva de `client-transactions` + `client-recurring` + `client-summary` que já existem.
- Cálculos memoizados com `useMemo` por `[tx, recurring, period, customStart, customEnd]`.
- Período não vira parte da `queryKey` (cálculo é client-side).

## Fora de escopo

- Não criar/alterar `v_client_financial_summary`.
- Não criar nova tabela, RPC, view ou migração.
- Não adicionar Recharts / nova dependência de gráfico — barras com `div`.
- Não voltar abas Mensalidades / Planos como top-level.
- Não tocar em sidebar, install PWA, login, dashboard, financeiro/recorrências/aportes/bancos/configurações globais, auth, RLS, assinaturas.

## Arquivos afetados

- `src/components/client-dossier.tsx` — único arquivo alterado:
  - renomear "A pagar" → "Total a receber"
  - subir estado de período para `ClienteDetalhe`
  - novos helpers locais `getPeriodRange` e `getPreviousPeriod`
  - `MainMetrics` e `ClientSummaryBlock` reagindo ao período
  - novo header de filtro + botão `Comparar período` dentro de `OverviewTab`
  - novo componente `ComparePeriodSheet` (Sheet + 4 cards comparativos + barras simples)
  - textos vazios mais claros no `ClientSummaryBlock`
