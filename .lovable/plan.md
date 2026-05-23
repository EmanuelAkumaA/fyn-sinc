## Objetivo
Melhorar a responsividade e o visual dos elementos dentro dos cartões de banco (rota `/bancos`), sem remover informação e sem mexer em lógica, dados ou outros módulos.

## Problema atual
No mobile (390px), os chips `Kuma · R$ 0,00`, `Aportes · R$ 0,00`, `Cashback · R$ 0,00` e `Taxas · -R$ 0,00` quebram em 2 linhas desalinhadas, o valor principal (R$ 0,00) fica colado no header, e o botão de editar concorre espaço com o nome do banco.

## Mudanças

### 1. `src/routes/_app/bancos.tsx` — layout do card
- Reorganizar o card em uma coluna vertical no mobile: header (logo + nome + status + botão editar) em cima, depois tipo de conta, depois saldo grande, depois chips.
- Botão de editar (`Pencil`) vai para o canto superior direito absoluto, com `h-8 w-8` e `text-muted-foreground`, para não roubar largura do nome.
- Nome do banco com `text-base sm:text-lg font-semibold`, `truncate` mantido.
- Tipo de conta com `text-[11px] uppercase tracking-wide text-muted-foreground`.
- Saldo principal: `text-2xl sm:text-3xl`, com `mt-4` e `tabular-nums` para alinhar dígitos.
- Padding do card: `p-4 sm:p-5`.
- Grid externo: manter `grid gap-3 md:grid-cols-2`, adicionar `gap-4` no mobile para respirar mais.

### 2. `src/components/bank-breakdown-chips.tsx` — chips mais bonitos e responsivos
- Aumentar densidade no mobile usando grid em vez de flex-wrap solto: `grid grid-cols-2 gap-1.5 mt-3` (2 colunas no mobile, vira `flex flex-wrap` em `sm:`).
- Cada chip ganha estrutura "label em cima, valor embaixo" só no mobile via `flex-col sm:flex-row sm:gap-1`, mantendo a mesma informação mas alinhando colunas de R$.
- Padding `px-2.5 py-1`, `rounded-lg`, `text-[11px]` no label e `text-xs font-semibold tabular-nums` no valor.
- Bordas mais sutis (`border-{cor}/15`), fundo `bg-{cor}/8`, melhor contraste em dark.
- Manter a paleta e a lógica de cores (Kuma verde / vermelho, Aportes primary, Cashback emerald, Taxas destructive).
- Manter `hideZero` e a ordem dos chips.

### Fora de escopo
Dashboard, lógica de cálculo, views SQL, formulários, outros módulos, navegação, calendário.

## Arquivos a alterar
- `src/routes/_app/bancos.tsx`
- `src/components/bank-breakdown-chips.tsx`
