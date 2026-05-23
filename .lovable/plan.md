## Objetivo

Dois ajustes pontuais de UI, sem mexer em lógica:

### 1. Tela Bancos — responsividade dos cards (mobile)
Arquivo: `src/routes/_app/bancos.tsx` + `src/components/bank-breakdown-chips.tsx`

Problema na imagem 01: os chips (Kuma, Aportes, Cashback, Taxas) ficam empilhados em coluna única ocupando muito espaço vertical e estourando visualmente no card.

Mudanças:
- Chips em grid 2 colunas no mobile (`grid grid-cols-2 gap-1.5`) e `flex-wrap` a partir de `sm:`.
- Reduzir padding/typography dos chips no mobile (`text-[11px] px-2 py-1`), truncar label e formatar valor de forma compacta para evitar overflow.
- No card do banco: reduzir gap entre header (logo+nome) e o saldo no mobile, e diminuir o tamanho do saldo principal (`text-2xl sm:text-3xl`) para sobrar espaço aos chips.
- Esconder chips com valor zero por padrão no mobile para limpar o card (mantém visual da imagem 02 onde só "Aportes" aparece quando relevante).

### 2. Dashboard — remover bloco "Contas e composição"
Arquivo: `src/routes/_app/dashboard.tsx`

- Remover o bloco/seção "Contas e composição" (grid com mini-cards de bancos + link "Ver todos os bancos").
- Manter o bloco "Composição dos bancos" (4 KPIs: Kuma líquido, Aportes, Cashbacks, Taxas) e o card "Saldo em bancos".
- Limpar imports não usados (BankBreakdownChips, ícones e query de breakdown se ficar órfã).

## Fora do escopo
Calendário, lógica financeira, view SQL, automações de cashback/taxa, navegação.
