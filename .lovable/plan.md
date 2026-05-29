## Fix: cards secundários ocupando só 1/3 no desktop

**Causa:** em `SecondaryMetrics`, quando `inline`, os 3 blocos ainda estão dentro de um `<div className="">`. O parent é `hidden lg:grid lg:grid-cols-3`, que vê 1 filho (o div) em vez de 3, deixando 2/3 da largura vazios à direita.

**Correção:** quando `inline=true`, renderizar os 3 blocos como filhos diretos (Fragment), sem o `<div>` envoltório. Quando `!inline` (mobile/accordion), manter o `<div className="space-y-3">`.

Arquivo: `src/routes/_app/despesas-planejamento.tsx` — função `SecondaryMetrics`.
