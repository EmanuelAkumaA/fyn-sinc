## Melhorar responsividade — Despesas & Planejamento

Ajustes focados em mobile (viewport 390px) sem mudar lógica/funcionalidade. Tudo em `src/routes/_app/despesas-planejamento.tsx`.

### Problemas atuais no mobile
1. **Header**: botões "Gerar lançamentos do mês" + "Nova despesa" lado a lado quebram e ficam apertados.
2. **Filtro de período**: `SelectTrigger w-40` + inputs de data `w-40` estouram a linha.
3. **Cards principais**: `grid-cols-2` ok, mas labels longos ("Saldo conservador", "Saldo esperado") truncam feio.
4. **Métricas secundárias** (`lg:grid-cols-3`): no mobile cada bloco ocupa altura demais — empilhamento ok, mas falta colapso.
5. **Tabs**: 10 abas em `flex-wrap` ocupam ~3 linhas e ficam visualmente ruidosas; melhor scroll horizontal no mobile.
6. **Lista de despesas**: cabeçalho do card (`flex justify-between`) fica espremido quando nome é longo + valor grande; barra de ações com 7 botões quebra mal.
7. **Top 5 / Categorias / Próximos vencimentos**: tipografia adequada, só falta ajuste fino.
8. **Sheets** (`sm:max-w-lg`): no mobile já viram full-width, ok — só revisar padding interno do form.

### Mudanças

**Header**
- `actions`: trocar `flex gap-2` por `flex flex-col sm:flex-row gap-2 w-full sm:w-auto`. Botões com `w-full sm:w-auto`. Encurtar texto no mobile: "Gerar mês" (`hidden sm:inline` para "lançamentos do").

**Filtro período**
- Container: manter `flex flex-wrap`. Select e inputs: `w-full sm:w-40` (full-width num só por linha no mobile, lado a lado em ≥sm).
- Label "Período:" com `w-full sm:w-auto`.

**Cards principais (7 métricas)**
- Atual: `grid-cols-2 md:grid-cols-4 xl:grid-cols-7`.
- Manter, mas: no mobile, mover "Saldo conservador" e "Saldo esperado" para uma seção secundária colapsável (Accordion "Projeção de caixa"), deixando 5 cards principais → `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` mais limpo no mobile.

**Métricas secundárias**
- Envolver os 3 blocos (Previsto x Realizado, Categorias, Próximos vencimentos) em um `<details>`/Accordion no mobile (`lg:` mostra direto). No mobile padrão: fechado, com resumo "Ver projeção e categorias".

**Top 5 maiores despesas**
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` (hoje: `sm:grid-cols-2 lg:grid-cols-5`, ruim em 390px).

**Tabs**
- Trocar `flex-wrap h-auto` por wrapper `overflow-x-auto` com `TabsList` `inline-flex w-max` (scroll horizontal no mobile, wrap em ≥md). Adicionar `scrollbar-thin`.

**Lista de despesas (cards)**
- Cabeçalho: `flex-col sm:flex-row sm:justify-between gap-2`; valor alinhado à esquerda no mobile com `text-right sm:text-right` ajustado para `text-left sm:text-right`.
- Barra de ações: agrupar ações principais (Lançar, Ver no Financeiro, Próxima) sempre visíveis; menos usadas (Editar, Pausar, Cancelar, Excluir) atrás de um `DropdownMenu` "Mais" no mobile (`sm:hidden` para o menu, `hidden sm:inline-flex` para botões individuais).

**Form Sheet**
- `grid grid-cols-2 gap-3` dos pares (Tipo/Categoria, etc.): trocar para `grid grid-cols-1 sm:grid-cols-2 gap-3` para empilhar no mobile.
- Botões do footer "Salvar / Salvar e lançar": `flex flex-col sm:flex-row` com `w-full sm:w-auto`.

### Detalhes técnicos
- Sem mudança de lógica/queries/mutations.
- Reusa componentes já existentes: `Accordion` (shadcn) para colapsos, `DropdownMenu` para "Mais ações".
- Imports adicionais em `despesas-planejamento.tsx`: `Accordion, AccordionContent, AccordionItem, AccordionTrigger` de `@/components/ui/accordion`; `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger` de `@/components/ui/dropdown-menu`; `MoreHorizontal` de `lucide-react`.
- Hook `useIsMobile` (já existe em `src/hooks/use-mobile.tsx`) usado só se necessário; preferir Tailwind responsive classes para evitar mismatch SSR.

### Arquivo tocado
- `src/routes/_app/despesas-planejamento.tsx` (apenas JSX/classes; lógica inalterada).
