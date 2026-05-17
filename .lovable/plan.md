## Plano: Responsividade do modal de detalhe do cliente

Foco em `src/routes/_app/clientes.tsx` (wrapper do Dialog) e `src/components/client-dossier.tsx` (header, resumo, abas, filtros, blocos da visão geral). Sem mudar lógica, queries, cálculos, regras financeiras nem cards principais (apenas o layout deles).

Breakpoints alvo:
- Mobile: até 639px (`< sm`)
- Tablet: 640–1023px (`sm` a `< lg`)
- Desktop: ≥ 1024px (`lg+`)

### 1. Wrapper do Dialog (`clientes.tsx` ~208)

Reestruturar o `DialogContent` para 3 comportamentos distintos:

- Mobile: fullscreen real (`w-screen h-[100dvh] max-w-none max-h-none rounded-none p-0`).
- Tablet (`sm`): `sm:w-[92vw] sm:h-auto sm:max-h-[90dvh] sm:rounded-2xl sm:max-w-3xl`.
- Desktop (`lg`): `lg:max-w-6xl`.

Estrutura interna:
- container externo `overflow-hidden flex flex-col`
- área de conteúdo interna única `flex-1 overflow-y-auto overflow-x-hidden` com padding `p-3 sm:p-5 lg:p-6`
- evitar duplo scroll: remover `overflow-y-auto` do `DialogContent` raiz, mover para o wrapper interno do `ClientDossier`.

Para isso o `ClientDossier` passa a renderizar um `<div className="flex flex-col h-full min-h-0">` com header + scroll area, em vez de fragmento `<>...</>`.

### 2. Header do cliente (`client-dossier.tsx` ~262)

Mobile (`flex-col`):
- Logo + nome empilhados (logo no topo)
- Badges (Ativo / Em dia) abaixo dos dados, em linha
- Botão "Editar cliente" `w-full` ao final
- Tipografia: `text-lg` no nome
- Padding `p-4`

Tablet (`sm`):
- Logo à esquerda, dados ao lado (`sm:flex-row sm:items-center`)
- Badges + botão alinhados à direita, mas com `sm:flex-row` ao invés de coluna empilhada
- Nome `sm:text-2xl`

Desktop (`lg`):
- Mantém o atual, com nome `lg:text-3xl` e botão `lg:w-auto`

Trocar breakpoints `md:` por `sm:`/`lg:` onde necessário para alinhar com a nova divisão (mobile/tablet/desktop).

### 3. Cards principais — MainMetrics (~477)

Manter conteúdo. Ajustar grid e densidade:
- `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3`
- `MetricBig`: `p-3 sm:p-4 lg:p-5`, ícone `h-8 w-8 lg:h-9 lg:w-9`, valor `text-base sm:text-xl lg:text-3xl`, label mantém `text-xs`

### 4. Resumo do cliente — ClientSummaryBlock (~568)

- Mobile (`grid-cols-1`): cada item em linha vertical (label em cima, valor embaixo), divisores entre todos os itens, padding `p-3`.
- Tablet (`sm:grid-cols-2`): 2 colunas; itens com label à esquerda e valor à direita (`sm:flex-row sm:items-center sm:justify-between`).
- Desktop: mantém `sm:grid-cols-2` (visual já amplo dentro do modal grande).

Ajustar a regra atual `md:` → `sm:` para que o tablet pegue 2 colunas.

### 5. TabsList (~324)

- Mobile/Tablet: `overflow-x-auto whitespace-nowrap` (já existe; scrollbar oculto pelo CSS global), garantir `-mx-1 px-1` para o primeiro/último não colarem na borda, e `min-h-11` para boa área de toque.
- Tornar a TabsList `sticky top-0 z-10 bg-background/95 backdrop-blur` dentro da área de scroll, para ficar visível ao rolar (regra opcional aplicada apenas se estável — manter por enquanto, pode ser revertido se causar problema visual).
- Desktop: comportamento normal.

### 6. Filtro de período + Comparar período (OverviewTab ~609)

Mobile (empilhado):
- `flex flex-col gap-2`
- Select de período `w-full`
- Em modo `custom`: data inicial `w-full`, separador some ou vira label, data final `w-full`
- Botão "Comparar período" `w-full` abaixo

Tablet retrato (`sm`):
- Pode manter empilhado se largura apertar; usar `sm:flex-row sm:flex-wrap sm:items-center` com `Select sm:w-44`, datas `sm:w-40`, botão `sm:w-auto sm:ml-auto`.

Desktop (`lg`):
- Tudo na mesma linha (já fica com `sm:flex-row` + `lg:` se necessário).

Mudar o container atual `flex flex-col md:flex-row md:items-center` → `flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2`.

### 7. Blocos da Visão Geral (~634)

Grid atual `grid lg:grid-cols-2`:
- Mobile: 1 coluna (já é).
- Tablet retrato (<768): 1 coluna.
- Tablet paisagem / desktop: 2 colunas → manter `lg:grid-cols-2` (cobre desktop) e adicionar `md:grid-cols-2` para tablet paisagem.

Cada card mantém `p-4` no desktop e ganha `p-3` no mobile.

### 8. Alturas e overflow

- `DialogContent` externo: `overflow-hidden`.
- Wrapper interno de scroll: `overflow-y-auto overflow-x-hidden flex-1 min-h-0`.
- Mobile usa `100dvh`; tablet/desktop `max-h-[90dvh]`.
- Garantir que o `<header>` do cliente fique dentro da área de scroll (não fixar), para não consumir altura útil.

### 9. Densidade visual

- Mobile: `p-3`, `gap-2`, `text-sm`/`text-base`, botões `h-9` (size sm) com `w-full` quando primários.
- Tablet: `p-4`, `gap-3`.
- Desktop: `p-5`/`p-6`, `gap-3`/`gap-4`.

### Fora de escopo

- Conteúdo/lógica das abas Financeiro, Aportes, Arquivos, Timeline, Observações (apenas o container Tabs e a TabsList sticky são tocados; o conteúdo interno fica como está).
- Queries, mutations, cálculos, regras financeiras.
- Estilo global, tokens de cor, outras telas.

### Validação

Abrir o modal em 360/390/414 (mobile), 768/834/1024 (tablet) e 1280/1536 (desktop) e checar:
- Mobile fullscreen sem overflow horizontal, header empilhado, cards 2×2, resumo em lista vertical, abas roláveis, filtro empilhado, blocos em 1 coluna, scroll único e fluido.
- Tablet com modal ~92vw centralizado, cards 2×2, resumo em 2 colunas, blocos em 2 colunas (paisagem) ou 1 (retrato).
- Desktop com layout amplo, comportamento atual preservado e refinado.
