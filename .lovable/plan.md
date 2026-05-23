## Objetivo

Melhorar a responsividade mobile do Dashboard / Calendário Financeiro / Financeiro, e trocar os chips de filtro do calendário por um `Select` dropdown (em todas as larguras, conforme escolhido).

## Mudanças

### 1. `src/components/financial-calendar.tsx`

**Filtro: chips → Select dropdown**
- Remover a barra horizontal de chips (`FILTERS.map(...)`).
- Substituir por um `<Select>` (shadcn) compacto alinhado à direita, com as mesmas 8 opções (Todos, A receber, Recebidos, Atrasados, Receita própria, Repasses, Mensalidades, Avulsos). `value` segue `filter`, `onValueChange={setFilter}`.
- Layout: o select fica na mesma linha do label "Previsão e recebimentos do mês" (label à esquerda, select à direita); empilha no mobile.

**Header do calendário (Hoje / setas / mês)**
- Atualmente os controles ficam na mesma linha do botão "Calendário financeiro", quebrando em telas estreitas.
- Reorganizar:
  - Mobile (`< sm`): o título fica em cima sozinho; uma segunda linha contém `Hoje | ← | Mês Ano | →` ocupando toda a largura (`justify-between`).
  - Desktop (`≥ sm`): comportamento atual (tudo na mesma linha).
- Reduzir `min-w-[120px]` do label do mês para algo flexível (`flex-1 sm:min-w-[120px] sm:flex-none`) e adicionar `text-xs sm:text-sm`.

### 2. `src/routes/_app/dashboard.tsx`

**Cards de métricas**
- Hoje: `grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4`.
- Ajustar `MetricCard` (ou as classes do grid) para reduzir padding/tamanho em mobile e evitar valores cortados em telas estreitas (`text-xl` em mobile, `text-2xl` em md+; padding `p-3 sm:p-4`).
- Verificar `src/components/metric-card.tsx` e aplicar classes responsivas no `value` e `label` se necessário (sem alterar a API do componente).

### 3. `src/routes/_app/financeiro.tsx`

**Barra de filtros nova (Período / Tipo / Status)**
- Hoje: `flex flex-wrap items-end gap-3` com `min-w-[140-160px]` por campo, o que estoura no mobile.
- Trocar para grid responsivo: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3` para que cada select ocupe metade da largura no mobile e linhas/colunas no desktop.
- Os dois campos do período personalizado (`De`, `Até`) ocupam uma linha própria abaixo quando `period === "custom"`.
- Reduzir `Label` para `text-[11px]` e remover `min-w-*` para evitar overflow horizontal.

## Fora de escopo

- Sidebar mobile, listagens (clientes, recorrências), formulários gerais — usuário pediu apenas os três pontos acima.
- Alterar lógica de filtragem ou queries — só layout/UI.
