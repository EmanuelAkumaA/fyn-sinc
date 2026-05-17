## Objetivo

Ao clicar em um card de cliente na página `/clientes`, em vez de navegar para `/clientes/$id`, abrir o dossiê completo (header + 8 abas já implementadas) dentro de um **Dialog grande** sobreposto à lista, mantendo a rota atual.

## Mudanças

### 1. Extrair conteúdo do dossiê em componente reutilizável
Arquivo novo: `src/components/client-dossier.tsx`
- Receber `clientId: string` por prop.
- Mover todo o conteúdo atual de `src/routes/_app/clientes.$id.tsx` (header com logo/status/edit, abas Overview/Financeiro/Mensalidades/Aportes/Planos/Arquivos/Timeline/Observações, hooks de queries) para esse componente.
- Remover dependência de `Route.useParams()` — usar a prop.
- Remover botão "Voltar" (não faz sentido em modal); manter botão de editar.

### 2. Simplificar a rota `/clientes/$id`
Arquivo: `src/routes/_app/clientes.$id.tsx`
- Manter a rota funcional (deep link continua valendo) renderizando apenas `<ClientDossier clientId={id} />` dentro do layout de página padrão.

### 3. Abrir como modal na lista de clientes
Arquivo: `src/routes/_app/clientes.tsx`
- Adicionar estado `viewingId: string | null`.
- Adicionar nova prop `onOpen` no `ClientCard` (ver passo 4).
- Renderizar `<Dialog open={!!viewingId} onOpenChange={...}>` com `DialogContent` largo (`max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto p-0`) contendo `<ClientDossier clientId={viewingId} />`.
- Manter o `Sheet` de edição (Novo/Editar) intacto.

### 4. Trocar o comportamento de clique do card
Arquivo: `src/components/client-card.tsx`
- Substituir o wrapper `<Link to="/clientes/$id">` por um `<button>` (ou `div` com `role="button"`) que chama `onOpen(client)`.
- Manter `stopNav` para os controles do dropdown (Editar).
- Preservar estilos atuais (`client-card group ...`) e acessibilidade (aria-label, foco).

## Detalhes técnicos

- Reaproveitar `Dialog` do shadcn (`@/components/ui/dialog`).
- Invalidação de cache via `invalidateClientCaches` continua igual — modal lê das mesmas queries.
- Ao fechar o modal, limpar `viewingId` para desmontar e liberar queries pesadas.
- Sem mudanças no banco, RLS, ou lógica de negócio.

## Fora de escopo

- Nenhuma alteração nos cálculos da view `v_client_financial_summary`.
- Nenhuma alteração no upload/storage de documentos.
- Sem mudanças nas rotas de outros módulos.