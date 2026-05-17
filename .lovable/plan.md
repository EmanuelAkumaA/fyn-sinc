## Plano: Colapsar seção "Operacional" no Dashboard

Tornar o cabeçalho **Operacional** clicável, atuando como um dropdown/accordion que mostra ou esconde os 6 cards da seção. Clique novamente fecha.

### Alterações

Arquivo único: `src/routes/_app/dashboard.tsx`

1. Adicionar um estado local `const [openOp, setOpenOp] = useState(false)` (fechado por padrão para deixar a tela mais limpa — pode ser ajustado).
2. Transformar o `<h2>Operacional</h2>` (linha 129) em um `<button>` com:
   - mesmo estilo visual atual (uppercase, tracking, muted-foreground)
   - ícone `ChevronDown` (do lucide, já usado no projeto) que gira 180° quando aberto via `transition-transform`
   - `onClick={() => setOpenOp(v => !v)}`
   - `aria-expanded={openOp}`
3. Renderizar o `<section>` dos 6 cards (linhas 130–137) condicionalmente quando `openOp` for `true`, com uma leve transição (`animate-in fade-in slide-in-from-top-1`) para ficar suave.

### Fora de escopo

- Seção principal de cards (Receita própria, Despesas, etc.) permanece sempre visível.
- Gráficos e demais blocos do dashboard não mudam.
- Sem alterações em estilos globais, tokens, dados, queries ou outros módulos.