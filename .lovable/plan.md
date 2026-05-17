# Landing page pública do Fyn Sinc

## Objetivo
Criar a página comercial em `/` apresentando o Fyn Sinc como sistema financeiro operacional para empresas de serviço, mantendo a identidade visual dark já existente (tokens em `src/styles.css`), sem alterar o sistema interno (rotas `_app/*`, auth, módulos).

## Mudança de rota raiz
Hoje `src/routes/index.tsx` redireciona `/` para `/dashboard` ou `/login`. Vou:
- Substituir `index.tsx` pela landing pública (a landing fica em `/`).
- Mover o redirect autenticado para `/_app` (já é layout autenticado) ou usar `/app` como atalho visual. O acesso ao sistema continua via `/login` → `/dashboard` (intocado).
- Botão "Entrar no App" → link para `/login`.
- Botão "Acessar Admin" → link visual para `/admin` (rota ainda não existe; apenas âncora visual, sem criar rota).
- Botão "Solicitar acesso" → rola até seção CTA / abre modal simples de interesse (apenas UI, sem backend).

## Estrutura de arquivos
- `src/routes/index.tsx` — página pública (compõe as seções).
- `src/components/landing/Header.tsx` — header fixo com nav e menu mobile (Sheet).
- `src/components/landing/Hero.tsx` — título, subtítulo, CTAs e mockup do dashboard (cards componentizados, sem imagem).
- `src/components/landing/ProblemSection.tsx` — grid de dores.
- `src/components/landing/TransformationSection.tsx` — comparativo Antes × Depois em duas colunas.
- `src/components/landing/HowItWorksSection.tsx` — 4 passos numerados.
- `src/components/landing/FeaturesSection.tsx` — grid de 10 cards de módulos com ícones lucide.
- `src/components/landing/ComparisonSection.tsx` — cards mês atual/anterior + gráfico simples (Recharts já no projeto? se não, SVG inline ou divs com altura proporcional para evitar dependência).
- `src/components/landing/AudienceSection.tsx` — cards "Para quem é".
- `src/components/landing/DifferentialsSection.tsx` — cards de diferenciais.
- `src/components/landing/AccessSection.tsx` — dois cards (App / Admin) + Solicitar acesso.
- `src/components/landing/FinalCTA.tsx` — bloco CTA final.
- `src/components/landing/Footer.tsx` — rodapé.
- `src/components/landing/RequestAccessDialog.tsx` — modal simples (nome, empresa, e-mail) sem submit real (apenas toast de confirmação).

Reuso de UI: `Button`, `Card`, `Dialog`/`Sheet`, `Input` do `src/components/ui/*` já existentes (shadcn). Ícones: `lucide-react`.

## Design system
- Usar exclusivamente tokens semânticos (`bg-background`, `text-foreground`, `text-primary`, `border-border`, `bg-card`, etc.).
- Glass: reaproveitar classe `.glass` e `--gradient-surface` já em `styles.css`.
- Acentos: `--primary` (verde petróleo) como cor principal; tom ciano via `--chart-1`/gradiente para apoio.
- Tipografia: títulos com `font-display` (Sora), corpo Inter (default).
- Adicionar, se necessário, utilitários extras em `styles.css` (ex.: gradiente de texto hero) usando tokens existentes — sem novas cores hardcoded.

## Responsividade
- Mobile-first; grids com `grid-cols-1 md:grid-cols-2 lg:grid-cols-3/4`.
- Header: nav horizontal em `md+`, `Sheet` lateral no mobile com mesmos links.
- Hero: stack vertical no mobile, 2 colunas (texto + mockup) em `lg+`.
- Tipografia escalonada (`text-4xl md:text-5xl lg:text-6xl`).

## SEO / head
- `head()` na rota `/` com `title`, `description`, `og:title`, `og:description` específicos do Fyn Sinc, em pt-BR.
- Um `<h1>` único na Hero; demais seções com `<h2>`.

## Animações
- Transições suaves Tailwind (`transition`, `hover:`), `animate-in`/`fade-in` via `tw-animate-css` já importado.
- Sem dependências novas. Sem Motion/GSAP.

## Mockup do dashboard (Hero)
Composição de cards (sem dados reais): "Receita própria", "Repasses", "Lucro líquido", "Recorrências ativas", "Clientes" com números fictícios e mini-sparkline em SVG inline.

## Seção comparativa
Cards (mês atual/anterior/Δ%) + gráfico de barras simples feito com divs (altura proporcional) para não introduzir dependência. Se Recharts já estiver instalado, posso usar; caso contrário, mantém SVG/divs.

## Fora de escopo
- Auth real, backend do "Solicitar acesso", rota `/admin`, alterações em `_app/*`, novos módulos.
- Tradução; tudo em pt-BR.

## Riscos / pontos de atenção
- Trocar o comportamento de `/` afeta usuários logados que esperavam ir direto pro dashboard. Mitigação: header com botão "Entrar" sempre visível apontando para `/login` (que já redireciona logados). Posso, opcionalmente, manter detecção de sessão e mostrar "Ir para o painel" se houver sessão — confirmo na implementação.
- Verificar se `Sheet` e `Dialog` já existem em `src/components/ui/` (shadcn padrão). Se faltarem, adiciono via shadcn na build.
