## Objetivo
Adicionar um filtro por cliente na tela **Financeiro** (`/financeiro`), junto aos filtros existentes (Período, Tipo, Status).

## Mudanças

**`src/routes/_app/financeiro.tsx`** (único arquivo alterado):

1. Adicionar estado `clientFilter` (default `"all"`).
2. Incluir `clientFilter` no `queryKey` e aplicar `q.eq("client_id", clientFilter)` quando ≠ `"all"`.
3. Adicionar um novo `Select` "Cliente" na barra de filtros, populado pela query `clients-min` que já existe.
   - Opções: "Todos" + lista de clientes ordenada por nome.
   - Incluir opção "Sem cliente" (`is("client_id", null)`) para lançamentos sem cliente vinculado (despesas próprias, transferências).
4. Ajustar o grid dos filtros para acomodar 4 campos:
   - Mobile: `grid-cols-2` (2x2).
   - Desktop (`sm:`): `grid-cols-4`.

## Fora de escopo
- Calendário Financeiro (intocado).
- Lógica de cálculo, views SQL, dashboard, bancos, navegação, autenticação.
- Outros módulos.
