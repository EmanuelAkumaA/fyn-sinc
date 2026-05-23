## Objetivo
Transformar o botão "Mais" da bottom nav mobile em um menu real que abre uma sheet/drawer com os itens que hoje não cabem: Planos/Ferramentas, Serviços, Bancos, Recorrências e Configurações.

## Mudanças

**`src/components/app-sidebar.tsx` — `MobileBottomNav`**
- Trocar o último item (hoje `Configurações` rotulado como "Mais") por um botão que abre uma `Sheet` (lateral/bottom) em vez de navegar direto.
- Marcar o botão como ativo quando a rota atual for uma das listadas no menu "Mais".
- Dentro da sheet, listar:
  - Recorrências (`/recorrencias`)
  - Planos/Ferramentas (`/planos`)
  - Serviços (`/servicos`)
  - Bancos (`/bancos`)
  - Configurações (`/configuracoes`)
  - Instalar app (reaproveitar `useInstallPwa`)
  - Sair (reaproveitar `signOutAndRedirect`)
- Cada item fecha a sheet ao clicar.
- Manter os 4 primeiros itens da bottom nav: Início, Clientes, Financeiro, Aportes.

## Detalhes técnicos
- Usar `Sheet` do shadcn (`@/components/ui/sheet`) com `side="bottom"` para sentir nativo no mobile, com `rounded-t-2xl` e `pb-[env(safe-area-inset-bottom)]`.
- Reusar os ícones do `lucide-react` já importados (`Repeat`, `Package`, `Briefcase`, `Building2`, `Settings`, `Download`, `LogOut`), adicionar `MoreHorizontal` para o gatilho.
- Estado local `const [moreOpen, setMoreOpen] = useState(false)`.
- Active state do botão "Mais": `const moreActive = ["/recorrencias","/planos","/servicos","/bancos","/configuracoes"].some(p => path === p || path.startsWith(p + "/"))`.
- Sem alterações em rotas, schemas ou backend.
