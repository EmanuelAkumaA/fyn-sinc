## Mudanças em `src/components/landing/LandingPage.tsx`

### 1. Logo no menu (header e mobile sheet)
Substituir o quadrado com `Sparkles` + texto "Fyn Sinc" pela logo da marca.

- Importar o asset: `import logoFull from "@/assets/logo-full.svg";` (já existe em `src/assets/`).
- Reescrever `Logo`:
  ```tsx
  function Logo({ className }: { className?: string }) {
    return (
      <Link to="/" className={cn("flex items-center", className)} aria-label="Fyn Sinc">
        <img src={logoFull} alt="Fyn Sinc" className="h-9 w-auto sm:h-10" />
      </Link>
    );
  }
  ```
- Header e SheetHeader já chamam `<Logo />`, então herdam automaticamente. O Footer também (mantém visual consistente).
- Remover import `Sparkles` apenas se não for mais usado — ele continua em uso na Hero (linha 291) e em `DifferentialsSection` (655), portanto **mantém**.

### 2. Nova seção FAQ (Perguntas frequentes)
Foco em respostas objetivas sobre **repasses**, **lucro real** e **onboarding**.

- Adicionar item no `NAV`: `{ href: "#faq", label: "FAQ" }` (depois de "Acesso").
- Criar componente `FAQSection` usando `Accordion` do shadcn (`@/components/ui/accordion`) — já é padrão shadcn. Se não existir no projeto, cair em `<details>`/`<summary>` nativos estilizados com Tailwind para evitar nova dependência.
- Estrutura: título com `SectionTitle` (kicker "FAQ", título "Perguntas frequentes"), grid de 1 coluna, max-w-3xl centralizado, fundo `bg-card/40` em cada item, bordas suaves.
- Conteúdo (pt-BR, respostas curtas, 1–3 frases):
  1. **Como o Fyn Sinc trata repasses de clientes?** — Repasses entram como movimentação separada da receita própria; o sistema calcula automaticamente o que é seu e o que pertence ao cliente, sem inflar o faturamento.
  2. **O que é "lucro real" no Fyn Sinc?** — É o resultado após descontar custos, comissões, taxas, cashback e repasses da receita própria. Você vê por cliente e no consolidado.
  3. **Repasse conta como minha receita?** — Não. Ele aparece como entrada/saída espelhada e não soma ao lucro — evita a ilusão de faturamento.
  4. **Como funciona o onboarding?** — Você cadastra clientes, planos, serviços, taxas e bancos; importa ou lança as primeiras movimentações; e o painel já mostra receita, repasses e lucro real do mês.
  5. **Quanto tempo leva para começar a usar?** — Operação básica no mesmo dia. Histórico e recorrências configurados conforme o volume de clientes.
  6. **Preciso integrar com banco ou ERP?** — Não é obrigatório. O Fyn Sinc funciona de forma independente; integrações futuras são opcionais.
  7. **Suporta comissões, cashback e taxas variáveis por cliente?** — Sim, todos são parâmetros por cliente/plano e entram automaticamente no cálculo do lucro real.

- Inserir `<FAQSection />` em `LandingPage` entre `<AccessSection />` e `<FinalCTA />`.
- Acessibilidade: `<h2>` único na seção; cada pergunta vira `<h3>` dentro do trigger.

### Fora de escopo
- Não alterar outras seções, tokens, rotas ou auth.
- Sem backend, sem novas dependências (Accordion é shadcn já padrão; fallback nativo se faltar).
