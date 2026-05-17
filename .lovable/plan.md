## Plano: Melhorar responsividade do modal de detalhes do cliente (mobile)

Foco: `src/components/client-dossier.tsx` + uma pequena ajuste no wrapper do modal em `src/routes/_app/clientes.tsx`. Sem mudar lógica nem dados.

### Problemas observados no print (390px)
- Cards "Total a receber" e "Saldo de aporte" aparecem cortados na direita (paddings + tamanho do valor estouram a coluna).
- Cabeçalho do cliente com botão "Editar cliente" empurrando layout.
- Linhas do "Resumo do cliente" com valores truncados à direita.
- Filtro do tab "Visão geral" com `Select w-44` + inputs de data `w-40` não cabem bem.
- Padding interno do modal (`p-4`) ainda generoso em telas estreitas.

### Alterações

1. **Wrapper do Dialog** (`src/routes/_app/clientes.tsx` linha 208)
   - `p-4 md:p-6` → `p-3 md:p-6`
   - Acrescentar `overflow-x-hidden` em conjunto com o `overflow-y-auto` existente.

2. **Header do cliente** (`client-dossier.tsx` ~262)
   - `p-5 md:p-6` → `p-4 md:p-6`
   - Título `text-2xl md:text-3xl` → `text-xl md:text-3xl`
   - Bloco direito (`shrink-0 flex flex-col md:items-end`): no mobile virar largura cheia abaixo dos dados, com botão "Editar cliente" `w-full md:w-auto`.
   - Adicionar `break-all` no email para não estourar.

3. **MainMetrics cards** (`MetricBig`, ~488)
   - `p-5` → `p-3 md:p-5`
   - Ícone `h-9 w-9` → `h-8 w-8 md:h-9 md:w-9`
   - Valor `text-2xl md:text-3xl` → `text-lg md:text-3xl` + `truncate` no contêiner do valor + `min-w-0` no card.
   - Label com `truncate` para não quebrar layout.

4. **ClientSummaryBlock** (~568)
   - `p-4 md:p-5` → `p-3 md:p-5`.
   - Linhas: no mobile empilhar (label em cima, valor embaixo) — substituir `flex items-center justify-between` por `flex flex-col md:flex-row md:items-center md:justify-between`.
   - Remover `truncate` da `<span>` do valor e usar `break-words text-left md:text-right` para evitar corte.

5. **Tabs** (`TabsList`, ~324)
   - Já tem `overflow-x-auto`; com scrollbar global oculto, a rolagem horizontal continua mas sem barra visível. Adicionar `px-1 -mx-1` para garantir que o primeiro/último item não fiquem colados na borda.

6. **OverviewTab filtros** (~609)
   - Linha do filtro: trocar larguras fixas por responsivas:
     - Select: `w-44` → `w-full sm:w-44`
     - Inputs de data: `w-40` → `w-full sm:w-40`
   - Botão "Comparar período": adicionar `w-full md:w-auto`.

7. **Cards de listas (Próximos vencimentos / Últimas movimentações)** (~635, 651)
   - Adicionar `shrink-0` ao valor `<span>` e garantir `min-w-0` no contêiner pai do texto (já tem) — apenas reforçar.

### Fora de escopo
- Lógica de períodos, queries, dados, métricas.
- Outras telas (Dashboard, Financeiro, Aportes, Bancos, etc.).
- Estilos globais e tokens de cor.

### Validação
Depois das mudanças, abrir o modal em 390px (mobile) e em 768px+ (tablet/desktop) e conferir: sem overflow horizontal, cards inteiros visíveis, header organizado, resumo legível, tabs roláveis sem barra.