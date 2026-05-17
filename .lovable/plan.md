## Plano: Scroll horizontal real das abas no mobile

Apenas a `TabsList` em `src/components/client-dossier.tsx` (~324). Sem mexer em cards, resumo, filtros, métricas, regras financeiras, conteúdo das abas, nem em desktop/tablet (o ajuste preserva o comportamento atual quando há espaço).

### Causa raiz

O `TabsList` do shadcn é `inline-flex h-9` com `justify-center`. As classes `overflow-x-auto justify-start whitespace-nowrap max-w-full` foram aplicadas direto nele, mas como ele é `inline-flex`, ele tenta caber em `max-w-full` e comprime os itens (radix ainda renderiza todos, porém alguns ficam visualmente cortados sem ativar a scrollbar — agravado pelo `scrollbar: none` global). Resultado: Timeline e Observações ficam fora da área visível e o usuário não consegue arrastar.

### Solução

Separar o "container que rola" do "trilho dos itens":

1. Envolver o `TabsList` em uma `<div>` wrapper de scroll:
   - `w-full overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]`
   - `mb-4` (move o margin atual pra cá)
   - `-mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6` para alinhar com o padding interno do modal (`p-3 sm:p-5 lg:p-6`) e permitir que a barra encoste nas bordas da área de scroll, com padding interno garantindo que a primeira/última aba não fiquem coladas.

2. Ajustar o `TabsList`:
   - `inline-flex w-max min-w-full bg-secondary/40 h-auto p-1 gap-0.5` (não `max-w-full`, não `overflow`)
   - Remove `overflow-x-auto`, `max-w-full` e `justify-start whitespace-nowrap` daqui (vai pro wrapper).

3. Ajustar cada `TabsTrigger`:
   - Adicionar `shrink-0 whitespace-nowrap min-h-9 px-3` para garantir boa área de toque no mobile e nenhum item ser comprimido. (O `whitespace-nowrap` já existe; reforça-se o `shrink-0` e `min-h-9`.)

### Verificação de containers pais

O `<DialogContent>` é `overflow-hidden` e o wrapper interno do `ClientDossier` é `overflow-y-auto overflow-x-hidden` — o `overflow-x-hidden` aqui não impede o filho de ter seu próprio `overflow-x-auto` (ele só impede o eixo X do próprio container). Portanto não há container pai que precise mudar. Cards e demais blocos continuam respeitando a largura.

### Fade lateral opcional

Adicionar máscara CSS no wrapper apenas quando a barra é rolável, via Tailwind arbitrary value:
```
[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] sm:[mask-image:none]
```
Aplicado só no mobile. Se causar problema visual com a aba ativa nas bordas, removemos.

### Fora de escopo

- Comportamento de cards, resumo, filtros, métricas, conteúdo das abas.
- Desktop/tablet (continuam funcionando: o `w-max min-w-full` faz a barra ocupar a largura total quando cabe).
- Estilo global de scrollbar (já oculto).

### Validação

Abrir o modal em 320/360/390px e arrastar a barra: confirmar que Timeline e Observações aparecem ao deslizar e que a aba ativa (mesmo nas pontas) é totalmente visível. Em ≥1024px todas as 6 abas aparecem sem scroll.
