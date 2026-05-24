## Objetivo
No tablet (768–1023px) a aplicação deve se comportar como o mobile: **sem sidebar lateral**, com a **barra de navegação inferior**. No desktop (≥1024px) nada muda. Mobile (<768px) também continua igual.

Hoje o corte é em `md:` (≥768px) — por isso o tablet já mostra a sidebar. A mudança central é trocar esse corte para `lg:` (≥1024px) nos pontos que controlam a navegação e o layout principal, e revisar as páginas para que o conteúdo no tablet use o mesmo padrão mobile (sem assumir sidebar ao lado).

## Mudanças

### 1. `src/components/app-sidebar.tsx`
- `AppSidebar` (a `<aside>`): trocar `hidden md:flex` por **`hidden lg:flex`** — some no tablet.
- `MobileBottomNav` (a `<nav>` inferior): trocar `md:hidden` por **`lg:hidden`** — aparece no tablet.

### 2. `src/routes/_app.tsx`
- `<main>`: `pb-24 md:pb-8` → **`pb-24 lg:pb-8`** (preserva espaço para a bottom nav no tablet).
- Container interno: `px-4 md:px-8` → **`px-4 lg:px-8`** (mantém o padding mobile no tablet, mais confortável sem sidebar).

### 3. Auditoria de páginas em `src/routes/_app/*.tsx`
Para cada página (`dashboard`, `clientes`, `financeiro`, `bancos`, `aportes`, `planos`, `servicos`, `recorrencias`):
- Onde `md:` é usado para **trocar entre layout mobile e layout "com sidebar"** (ex.: `md:hidden` em cards de lista + `hidden md:block` em tabela, toolbars que viram horizontais só com sidebar, headers de página que mudam de stack para row), trocar esses casos pontuais para **`lg:`**, para que o tablet continue usando a versão mobile-friendly.
- Onde `md:` é usado apenas para **aumentar densidade de grid** (ex.: `grid-cols-1 md:grid-cols-2`, `md:grid-cols-3`, `md:grid-cols-4` em cards de métrica), **manter `md:`** — com a sidebar fora no tablet sobra largura e essas grades ficam melhores, não pior.
- Critério de decisão por ocorrência: se o elemento ficava cramped no tablet com sidebar presente, agora vai respirar; se o elemento dependia de "ter ao menos a largura de um desktop", subir o breakpoint para `lg:`.

Não vou listar todas as ocorrências aqui — passo arquivo por arquivo aplicando esse critério. Sem mudanças de lógica, só classes Tailwind.

## Fora de escopo
- Mobile (<768px) e desktop (≥1024px): nenhuma alteração visual.
- Lógica de negócio, dados, autenticação, filtros, cálculos: nada muda.
- Componentes compartilhados que já são responsivos com `md:`/`lg:` corretos (ex.: `bank-breakdown-chips`, `metric-card`) não são tocados a menos que a auditoria mostre regressão no tablet.

## Resultado esperado
- Tablet (768–1023px): sem sidebar lateral, com barra inferior, conteúdo ocupando a largura total e usando o mesmo padrão visual do mobile (sem layouts de "tabela larga" forçados).
- Desktop e mobile: idênticos ao atual.
