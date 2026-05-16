## Objetivo

Tornar o módulo **Clientes** mais visual e premium: cada cliente passa a ter logo e cor de marca próprias, com hover dinâmico nos cards usando essa cor. Sem mexer em lógica financeira, dashboard, recorrências ou aportes.

---

## 1. Banco de dados (migration Supabase)

Adicionar dois campos opcionais à tabela `clients`:

- `logo_url text null` — URL pública da imagem.
- `brand_color text null` — cor HEX (ex.: `#14B8A6`).

RLS já existente (`is_org_member(organization_id)`) cobre os novos campos automaticamente — nenhuma policy nova é necessária.

Após a migration, o arquivo `src/integrations/supabase/types.ts` será regenerado.

---

## 2. Helper visual compartilhado

Criar `src/lib/client-brand.ts` com:

- `DEFAULT_BRAND_COLOR = "#14B8A6"`
- `getBrandColor(client)` — retorna `brand_color` ou fallback.
- `hexToRgba(hex, alpha)` — converte HEX para `rgba(...)` (usado no glow/box-shadow, evita depender de `color-mix`).
- `getInitials(name)` — 1–2 letras maiúsculas.
- `isValidHex(value)` — valida `#RGB` / `#RRGGBB`.

---

## 3. Componentes novos

**`src/components/client-logo.tsx`**
- Props: `client`, `size` (`sm` 44px / `md` 48px), `glow?: boolean`.
- Container quadrado, `rounded-xl`, fundo escuro, borda sutil, `object-fit: contain`, padding 6px.
- Se `logo_url` ausente OU `onError` na imagem → fallback com iniciais, fundo `brand_color` em baixa opacidade, borda `brand_color`, texto branco.
- Quando `glow`, aplica leve `drop-shadow` na cor da marca.

**`src/components/client-card.tsx`**
- Extrai o card atual da listagem.
- Recebe `style={{ "--client-color": getBrandColor(client) }}`.
- Layout: logo à esquerda · nome + responsável/telefone/e-mail no centro · `StatusBadge` + menu `...` à direita.
- Borda padrão `rgba(247,249,250,0.10)`, `rounded-[20px]`, padding generoso, `transition` 250ms.
- Hover (desktop, via `@media (hover: hover)`): borda na cor da marca, `box-shadow: 0 0 0 1px var(--client-color), 0 0 28px <rgba brand 25%>`, `translateY(-2px)`, gradiente discreto de fundo, brilho na logo.
- Mobile: hover desativado, mas borda **esquerda** de 3px em `var(--client-color)` como acento permanente.

---

## 4. Formulário de cliente

Em `src/routes/_app/clientes.tsx` (`ClientForm`):

- Nova seção **"Identidade visual do cliente"** ao final do formulário, antes do botão.
- Campo **Logo do cliente**: `Input` URL, placeholder e texto auxiliar conforme briefing.
- Campo **Cor da marca**: `<input type="color">` + `Input` HEX sincronizados, com um quadrado de preview.
- Validação client-side: se HEX preenchido e inválido → toast de erro e bloqueia submit.
- Preview ao vivo do `ClientCard` logo abaixo dos campos, usando os valores atuais do formulário.
- Mutation `create` já existente passa `logo_url` e `brand_color` no `insert`.

Adicionar também suporte a **edição** do cliente:
- Botão "Editar" no menu `...` do card abre o mesmo `Sheet` em modo edição.
- Usa `update` em vez de `insert`.

---

## 5. Listagem `/clientes`

- Substituir o `<Link>` inline atual pelo novo `<ClientCard client={c} />`.
- Mantém grid vertical (`grid gap-3`), busca e empty state como estão.

---

## 6. Detalhe `/clientes/$id`

Atualizar o header em `src/routes/_app/clientes.$id.tsx`:

- Bloco "perfil premium": container com `--client-color`, leve glow/acento à esquerda na cor da marca.
- Logo grande (64px) à esquerda usando `<ClientLogo size="md" glow />`.
- Nome, responsável (`company`), telefone, e-mail, `StatusBadge` e ações alinhados.
- Fallback de iniciais idêntico ao card.
- Resto da página (tabs, métricas, transações) **não muda**.

---

## 7. Fora de escopo (não tocar)

- Dashboard, Financeiro, Recorrências, Aportes/Repasses, regras financeiras.
- Upload de logo via Supabase Storage (só URL por enquanto).
- Extração automática de cor dominante / `canvas` / libs pesadas.
- RLS existente.

---

## Detalhes técnicos

- Migration via `supabase--migration` (eu chamo a tool e aguardo aprovação antes de qualquer código).
- Tokens de cor neutros continuam vindo de `src/styles.css`; a cor da marca entra **apenas** via variável CSS inline `--client-color` no card/header (não vira token global).
- Hover só no desktop: usar `@media (hover: hover) and (pointer: fine)` para não disparar em touch.
- `onError` no `<img>` da logo troca para fallback sem quebrar layout.
- Todos os novos arquivos seguem o padrão do projeto (TanStack Start, Tailwind v4, shadcn).

---

## Arquivos afetados

**Novos**
- `src/lib/client-brand.ts`
- `src/components/client-logo.tsx`
- `src/components/client-card.tsx`

**Editados**
- `src/routes/_app/clientes.tsx` (form + edição + uso do ClientCard)
- `src/routes/_app/clientes.$id.tsx` (header premium)
- `src/integrations/supabase/types.ts` (regenerado pela migration)

**Migration**
- `clients`: `+ logo_url text`, `+ brand_color text`
