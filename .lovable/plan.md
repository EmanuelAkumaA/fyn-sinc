## Contexto

Hoje o Fyn Sinc tem o Dashboard com cards de métricas + gráficos e a página Financeiro com lista de lançamentos. Não existe uma visão de calendário que mostre, dia a dia, o que vai entrar, o que entrou e o que está atrasado.

Quero adicionar um bloco **Calendário financeiro** focado em **previsão vs recebimento do mês**, sem mudar nenhuma regra financeira existente.

## Onde vai ficar

- Novo componente reutilizável: `src/components/financial-calendar.tsx`.
- Plugado no **Dashboard** (`src/routes/_app/dashboard.tsx`) como bloco **recolhível**, no mesmo padrão do "Operacional" (botão com `ChevronDown` que expande/oculta).
- Posição: logo abaixo dos cards principais de métricas, antes dos gráficos.
- Não vou tocar em Financeiro nesta etapa (fica preparado para reuso depois).

## Estrutura do bloco

Topo do bloco:
- Título "Calendário financeiro" + subtítulo "Previsão e recebimentos do mês".
- Controles do mês: `[Hoje] [<] Maio de 2026 [>]`.
- Botão de ocultar/mostrar (mesmo padrão "Operacional").

4 cards-resumo compactos (acima do calendário):
1. **Previsto no mês** — soma de receita própria pendente com `due_date` no mês — ciano.
2. **Recebido no mês** — soma de receita própria paga com `paid_at` no mês — verde.
3. **Em atraso** — pendentes com `due_date < hoje` — vermelho.
4. **A receber** — pendentes com `due_date >= hoje` ainda no mês — branco/ciano.

Calendário (desktop/tablet):
- Grid mensal 7 colunas (seg–dom), células com radius suave e fundo `glass`.
- Cada célula: número do dia + até 2–3 chips compactos (label curto + valor).
- Se houver mais de 3 lançamentos, mostrar "+N" com tooltip.
- Hoje: borda destacada em ciano.
- Dias fora do mês: opacidade reduzida.

Calendário (mobile, < 768px):
- Substituir grid por **agenda em lista**, agrupada por dia (apenas dias com lançamentos), no padrão pedido (data + lista de lançamentos com cliente, valor, status).
- Detectar via `useIsMobile` (já existe em `src/hooks/use-mobile.tsx`).

## Cores e status

Tudo via tokens do design system (`src/styles.css`). Vou usar os já existentes `--success` (verde), `--destructive` (vermelho), `--primary` (ciano/azul) e `--muted-foreground`. Sem cores hardcoded.

| Categoria       | Label      | Token                  |
|-----------------|------------|------------------------|
| Receita pendente futura | A receber  | primary / ciano        |
| Receita paga    | Recebido   | success                |
| Vencido + não pago | Atrasado   | destructive            |
| Repasse recebido | Repasse    | muted/ciano secundário |
| Taxa/Despesa    | Despesa    | destructive discreto   |

## Regras de data (posicionamento no calendário)

- `status = "pago"` → exibe no dia de `paid_at`.
- `status = "pendente"` e `due_date >= hoje` → exibe no `due_date` como **A receber**.
- `status = "pendente"` e `due_date < hoje` → exibe no `due_date` como **Atrasado**.
- Recorrências (`recurring_contracts`) **não** aparecem direto — só as `financial_transactions` que elas já geraram.
- `repasse_recebido` e `uso_repasse` aparecem com chip próprio, **não somam** nos cards de receita/despesa própria.
- `transferencia` não entra no calendário (não impacta lucro).

## Drawer de detalhes do dia

Ao clicar em um dia (ou item na agenda mobile), abrir um `Sheet` (lateral no desktop, bottom no mobile) com:
- Data + resumo (a receber, recebido, atrasado, repasses).
- Lista de lançamentos do dia: cliente, descrição, tipo, valor, status, banco, vencimento ou data de pagamento.
- Ações por item:
  - **Marcar como pago** → abre o mesmo `payTx` Dialog do Financeiro. Para evitar duplicar código, vou **extrair** o conteúdo do diálogo de pagamento de `src/routes/_app/financeiro.tsx` para `src/components/pay-transaction-dialog.tsx` e reusar nos dois lugares (mesmo fluxo: taxa, banco, data). Sem fluxo paralelo.
  - **Abrir cliente** → navega para `/clientes/$id`.
  - **Ver no financeiro** → navega para `/financeiro` (filtro fica para depois).

## Filtros

Barra de chips de filtro acima do calendário:
- Todos | A receber | Recebidos | Atrasados | Receita própria | Repasses | Mensalidades | Avulsos.
- Filtro por cliente: deixar **preparado** (estrutura no estado), mas sem UI nesta etapa para manter escopo enxuto.

"Mensalidades" = transações com `recurring_contract_id` não nulo. "Avulsos" = sem `recurring_contract_id`.

## Estado vazio

Quando o mês não tem nenhum lançamento que passe os filtros:
- "Nenhum lançamento financeiro neste mês."
- "Quando você criar receitas, recorrências ou marcar pagamentos, eles aparecerão aqui."

## Dados / Queries

Nova query:
```
queryKey: ["calendar", organizationId, "YYYY-MM"]
```
Busca `financial_transactions` da org com `due_date` ou `paid_at` dentro do mês (faixa de datas no Supabase com `or`). Reaproveita `clients-min` para mostrar nome.

Invalidação: ao mudar de mês recarrega; após pagamento/edição, `invalidateQueries(["calendar"])` + `["transactions"]` + `["dashboard"]` (o `pay-transaction-dialog` já faz isso). Cobre todas as mutações listadas.

## Arquivos afetados

**Novos**
- `src/components/financial-calendar.tsx` — componente principal (header, cards, grid/agenda, filtros, drawer).
- `src/components/pay-transaction-dialog.tsx` — extração do diálogo de pagamento atual.

**Editados**
- `src/routes/_app/financeiro.tsx` — passa a usar `PayTransactionDialog`.
- `src/routes/_app/dashboard.tsx` — adiciona bloco recolhível "Calendário financeiro" abaixo das métricas.

Sem migrations, sem mudanças no schema, sem mudanças nas regras financeiras.

## Fora de escopo nesta etapa

- Filtro por cliente com UI.
- Reuso na página Financeiro (fica fácil depois, já que o componente é independente).
- Exportar / imprimir calendário.
- Notificações de vencimento.
