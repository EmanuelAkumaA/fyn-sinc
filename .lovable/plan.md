## Contexto

No dossiê do cliente, o card **Mensalidades ativas** apenas lista as recorrências (`recurring_contracts`) vinculadas, sem nenhuma ação. Hoje aparece "Serviço teste · R$ 300,00" mesmo sem nenhum lançamento financeiro gerado, e não há como remover/pausar dali — só indo até a página **Recorrências**.

## O que vou fazer

No card **Mensalidades ativas** (`src/components/client-dossier.tsx`, por volta da linha 766), em cada item da lista vou adicionar um menu de ações (ícone "⋯") com:

1. **Pausar** — muda `status` da recorrência para `pausado` (some da lista de "ativas").
2. **Excluir** — abre confirmação e remove o `recurring_contract`. Se houver transações financeiras já geradas vinculadas, mostro aviso na confirmação ("X lançamentos vinculados serão mantidos") e mesmo assim permito excluir só o contrato.
3. **Abrir em Recorrências** — atalho navegando para `/recorrencias` já filtrando pelo cliente (se a página suportar; caso contrário só leva à página).

Cada ação invalida os caches via `invalidateClientCaches` para o card atualizar na hora.

Não vou mexer na geração automática de lançamentos — só na gestão da própria recorrência a partir do dossiê.

## Detalhes técnicos

- Reuso de `DropdownMenu` / `AlertDialog` do shadcn (já usados no projeto).
- Mutations com `useMutation` + `supabase.from("recurring_contracts").update({status:'pausado'})` e `.delete().eq('id', r.id)`.
- Toast de sucesso/erro com `sonner`.
- Chave de query a invalidar: `["client-recurring", clientId]` + `invalidateClientCaches(qc, clientId)`.

## Arquivo afetado

- `src/components/client-dossier.tsx` (apenas o bloco do card "Mensalidades ativas" + imports de ícones/menu).
