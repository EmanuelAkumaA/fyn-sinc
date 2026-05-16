## Reclassificação de Clientes em dois status

Hoje a tabela `clients` tem um único `status` (enum `client_status`: `ativo | inativo | inadimplente`) que mistura situação comercial e financeira. Vamos separar em dois campos independentes, atualizar UI, filtros e detalhe.

---

### 1. Banco de dados (migração)

Adicionar duas colunas TEXT na tabela `clients` (não usar enum para facilitar evoluções futuras):

- `client_status text not null default 'ativo'` — valores: `ativo | inativo`
- `financial_status text not null default 'em_dia'` — valores: `em_dia | inadimplente`

Migração de dados a partir do `status` antigo:
- `status = 'ativo'`     → `client_status='ativo'`,   `financial_status='em_dia'`
- `status = 'inativo'`   → `client_status='inativo'`, `financial_status='em_dia'`
- `status = 'inadimplente'` → `client_status='ativo'`, `financial_status='inadimplente'`

Coluna `status` antiga: **mantida** por enquanto (não dropar) para evitar quebra; UI deixa de lê‑la. Adicionar `CHECK` constraints nas duas novas colunas. RLS atual por `organization_id` (`is_org_member`) continua valendo — nada a mudar nas policies.

Índices: criar `idx_clients_org_client_status` e `idx_clients_org_financial_status` para acelerar filtros combinados.

### 2. Tipos

`src/integrations/supabase/types.ts` é regenerado após a migração — sem edição manual. Em `clientes.tsx` / `clientes.$id.tsx` / `client-card.tsx`, atualizar o tipo local `ClientRow`/`ClientLike` para incluir `client_status` e `financial_status` e parar de depender de `status`.

### 3. Componente de badge

Em `src/components/ui-helpers.tsx`, adicionar dois componentes específicos (mantém `StatusBadge` genérico para transações/planos):

- `ClientStatusBadge({ value }: { value: 'ativo' | 'inativo' })`
  - `ativo` → verde (token `--success`)
  - `inativo` → cinza (`bg-muted text-muted-foreground`)
- `FinancialStatusBadge({ value }: { value: 'em_dia' | 'inadimplente' })`
  - `em_dia` → verde suave / azul petróleo (token `--primary` em tonalidade leve)
  - `inadimplente` → vermelho (token `--destructive`)

Textos: `Ativo`, `Inativo`, `Em dia`, `Inadimplente`.

### 4. Formulário de cliente (`ClientForm` em `src/routes/_app/clientes.tsx`)

- Adicionar dois `Select` lado a lado, logo após o campo "Tipo / CPF-CNPJ":
  - **Status do cliente** — Ativo / Inativo (default Ativo)
  - **Situação financeira** — Em dia / Inadimplente (default Em dia)
- Atualizar `FormState`, `emptyForm`, `useEffect(initial)` e `handleSubmit` para enviar os novos campos. Remover qualquer referência a `status`.

### 5. Listagem `/clientes`

- Atualizar `useQuery` para selecionar os novos campos.
- Acima da busca, adicionar uma barra de filtros com dois `Select`:
  - Status do cliente: Todos / Ativos / Inativos
  - Situação financeira: Todos / Em dia / Inadimplentes
- Busca textual já existente passa a casar também em `company`, `email`, `phone`, `document` (hoje só filtra por `name`).
- Filtros combinam por AND com a busca.
- Persistir filtros via `validateSearch` do TanStack Router (opcional, mas recomendado) para deep‑link — ou apenas `useState` se preferir manter simples. Vou de `useState` para escopo mínimo.

### 6. Cards de resumo

Acima dos filtros, 4 mini‑cards (componente `Mini` ou similar já em uso):
- Total de clientes
- Ativos
- Inativos
- Inadimplentes

Calculados a partir do `clients` já carregado (sem nova query).

### 7. `ClientCard`

- Trocar o único `<StatusBadge>` por **dois** badges em sequência: `<ClientStatusBadge>` + `<FinancialStatusBadge>`.
- Manter memoização (`React.memo` + `useMemo` para style) já implementada.

### 8. Detalhe `/clientes/$id`

- No header, mostrar os dois badges (substituindo o `StatusBadge` atual).
- Se `financial_status === 'inadimplente'`, exibir um alerta sutil abaixo do header: faixa com fundo `--destructive/10`, ícone de alerta e texto "Cliente com pendências financeiras".
- Edição: reutiliza o formulário atualizado em `clientes.tsx` (já cobre ambos os campos).

### 9. Pré-visualização no formulário

O `ClientCard` de preview no `ClientForm` passa a receber `client_status` e `financial_status` do estado do formulário.

### 10. Fora do escopo

- Automação que recalcula `financial_status` a partir de vencimentos (deixar campos prontos, mas continuar manual).
- Mexer em Financeiro, Dashboard, Recorrências, Aportes.
- Remover o enum/coluna `status` antiga (fica para uma limpeza futura, depois de confirmado que nada mais lê).

### Arquivos afetados

- Migração SQL (nova) — `clients.client_status`, `clients.financial_status`, backfill, índices.
- `src/components/ui-helpers.tsx` — novos badges.
- `src/components/client-card.tsx` — dois badges, tipo atualizado.
- `src/routes/_app/clientes.tsx` — form (selects), filtros, cards de resumo, busca expandida.
- `src/routes/_app/clientes.$id.tsx` — header com dois badges, alerta de inadimplência.

### Validação

- Após migração: listagem carrega clientes existentes com os dois badges corretos derivados do `status` legado.
- Criar novo cliente: defaults `Ativo` + `Em dia`.
- Mudar para `Inativo` + `Inadimplente`: salva e reflete nos badges, no detalhe e nos filtros combinados.
- Card de resumo "Inadimplentes" bate com a contagem filtrada.

Posso seguir?