## Problema

No dossiê do cliente, na lista **Últimas movimentações** (e na lista de **Próximos vencimentos** logo ao lado, que usa o mesmo padrão), descrições longas como *"Cashback de Compra de Dominio para Evoluí"* podem escapar do card porque o valor à direita (`R$ 0,60`) não tem `shrink-0` e a `<li>` não força `min-w-0` em toda a cadeia.

## O que vou alterar

Apenas em `src/components/client-dossier.tsx`, nos itens dessas duas listas:

1. **Respeitar o espaço do card**
   - Garantir `min-w-0` na `<li>` e no wrapper de texto.
   - Adicionar `shrink-0` + `whitespace-nowrap` no valor (`R$ ...`) para ele não empurrar a descrição.
   - Manter `truncate` na descrição (já existe) e adicionar `truncate` também na linha de tipo/data.

2. **Animação de marquee ao passar o mouse**
   - Criar um pequeno componente `MarqueeText` que:
     - mede se o texto está realmente truncado (scrollWidth > clientWidth);
     - se sim, ao `hover` desliza o texto da direita para a esquerda em loop suave (CSS `@keyframes marquee` com `transform: translateX`), pausa quando o mouse sai;
     - se não, comporta-se como `<span class="truncate">` normal.
   - Definir o keyframe `marquee` em `src/styles.css` (ex.: `@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-100%) } }`) e uma classe utilitária `.animate-marquee` com `animation: marquee 8s linear infinite`.
   - Usar `MarqueeText` na descrição dos itens de **Últimas movimentações** e **Próximos vencimentos** dentro do dossiê.

## Fora do escopo

- Não mexo em outras telas (Financeiro, Dashboard, Bancos, etc.).
- Não altero dados, queries ou regras de negócio.
- Não mudo o layout dos cards de métricas no topo.

## Resultado esperado

Descrições longas ficam contidas no card, cortadas com `…`. Ao passar o mouse sobre uma descrição truncada, o texto rola horizontalmente em loop até o usuário tirar o cursor.
