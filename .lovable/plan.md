## Objetivo

Em cada card da tela **Bancos**, mostrar o saldo total e separá-lo em duas parcelas:
- **Cliente** — dinheiro que entrou via aportes/repasses e ainda não foi usado.
- **Kuma** — o restante (saldo real da Kuma na conta).

## O que muda

Apenas a tela `src/routes/_app/bancos.tsx`. Nada de schema novo, nada em Dashboard/Aportes/Financeiro.

## Cálculo

Para cada banco:
- `total` = `current_balance` da view `v_bank_balance` (já usado hoje).
- `cliente` = soma das transações em `financial_transactions` agrupadas por `bank_id`:
  - `+amount` quando `type = 'repasse_recebido'`
  - `−amount` quando `type = 'uso_repasse'`
- `kuma` = `total − cliente`.

Nova query React Query `['bank-client-balances', orgId]` que retorna um mapa `{ bank_id → cliente }`. Roda em paralelo com a query de bancos.

## UI no card

Mantém o número grande atual como **Total**. Logo abaixo, duas mini-badges lado a lado:

```text
R$ 2.000,00          ← total (como hoje)
[ Kuma  R$ 1.700,00 ]  [ Cliente  R$ 300,00 ]
```

- Badge **Kuma**: cor `success` (verde) quando ≥ 0, `destructive` quando negativo.
- Badge **Cliente**: cor `primary`.
- Se `cliente === 0`, a linha de badges é omitida (cards sem aportes ficam idênticos ao layout atual).

Formatação reusa o helper `currency()` já existente no arquivo.

## Fora de escopo

- Cards de topo (Saldo Consolidado / Contas Ativas / Saldo Inicial) ficam como estão.
- Nenhuma mudança em Aportes/Repasses, Dashboard ou no schema do banco.
