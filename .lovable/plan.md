## 1. Card Financeiro — Responsividade (Imagem 01)

Arquivo: `src/routes/_app/financeiro.tsx` (linhas ~169-202)

Hoje o row usa `flex items-center` com várias colunas lado a lado — em 393px tudo quebra verticalmente de forma desorganizada (descrição, tipo, cliente, data, valor, status e botões empilhados em ordem aleatória).

Reestruturar cada linha em **2 linhas no mobile**, voltando para uma linha em `sm:`:
- **Linha 1**: descrição (truncate) à esquerda + valor à direita.
- **Linha 2**: meta (tipo · cliente · data) à esquerda; à direita, `StatusBadge` + botões "Pagar" e "Excluir".

Estrutura:
```text
[descrição.................][R$ valor]
[tipo · cliente · data] [Pendente] [✓] [🗑]
```

Em `sm:` (≥640px) volta ao layout horizontal atual.

## 2. Card Cliente — Overflow + novo campo Nome completo (Imagem 02)

### 2a. Schema — novo campo `full_name`
Migration: adicionar coluna `full_name text` em `public.clients` (nullable). Nenhuma RLS nova.

### 2b. Form (`src/components/client-form.tsx` + `src/lib/schemas.ts`)
- Renomear o label atual "Nome da Empresa *" para **"Nome curto *"** (placeholder: ex. "Rac Social"). É o que aparece no card.
- Adicionar campo **"Nome completo"** (opcional, abaixo) — usado em dossiê/relatórios/contratos, não no card.
- Atualizar `ClientFormState`, `ClientRow`, `emptyClientForm` e `clientSchema` (validação: `full_name` opcional, max 255).
- Submeter `full_name` no insert/update de `clientes.tsx` (já passa `...data`).

### 2c. Card (`src/components/client-card.tsx`)
- Garantir `min-w-0` no container do nome + `truncate` (já tem, mas `flex-1 min-w-0` precisa estar correto no pai). Os badges "Ativo / Em dia" estavam saindo da tela: envolver a área dos badges com `shrink-0` e a área de contatos com `min-w-0 flex-1` (já está), mas hoje os badges ficam no mesmo `flex-wrap` — em 393px com telefone longo eles vão pra direita e cortam.
- Mudar a Linha 2 para: em mobile, badges em **uma terceira linha** própria (`flex-col sm:flex-row sm:items-center sm:justify-between`), evitando overflow horizontal.
- Reduzir tamanho da fonte do nome em mobile (`text-sm sm:text-base`) já que agora é "Nome curto".

## 3. Aplicação automática da cor da logo (Imagem 03)

Arquivo: `src/components/client-form.tsx` (linhas 209-216)

Hoje a cor extraída só é aplicada se `!brandColorTouched`. O usuário quer que **toda vez que uma nova logo for enviada**, a cor seja recalculada e aplicada — sobrescrevendo qualquer cor manual anterior.

Mudança:
- No `onChange` do `ClientLogoUpload`, sempre aplicar `extractedColor` quando presente (remover o guard `!brandColorTouched`).
- Resetar `brandColorTouched = false` após upload, para que futuras extrações continuem sobrescrevendo até o usuário editar manualmente de novo.
- A edição manual no color picker / input continua marcando `brandColorTouched = true` (sem efeito imediato, mas preserva valor até próximo upload).

Comportamento final: subir logo → cor extraída aplicada automaticamente; usuário pode ajustar manualmente; subir outra logo → nova cor sobrescreve.

## Arquivos alterados

- `supabase/migrations/<novo>.sql` — adiciona `clients.full_name`
- `src/lib/schemas.ts` — campo `full_name` opcional
- `src/components/client-form.tsx` — labels, novo campo, auto-aplicar cor
- `src/components/client-card.tsx` — layout responsivo dos badges
- `src/routes/_app/financeiro.tsx` — layout responsivo do row
