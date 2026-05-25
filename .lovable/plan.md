# Agrupar Financeiro em 3 seções colapsáveis

## Objetivo
Na página `/financeiro`, substituir a lista plana de lançamentos por 3 grupos colapsáveis (`Collapsible` do shadcn) que classificam dinamicamente cada transação conforme seu status e data de vencimento.

## Regras de classificação
Para cada item de `tx` (já filtrado pelos filtros atuais de Período/Tipo/Status/Cliente):

- **Pendentes** → `status !== 'pago'` AND `status !== 'cancelado'` AND (`due_date` é nula OU `due_date >= hoje`)
- **Vencidos** → `status !== 'pago'` AND `status !== 'cancelado'` AND `due_date < hoje`
- **Pagos** → `status === 'pago'`

`hoje` = data local truncada (sem hora). Cancelados continuam aparecendo? → seguem o filtro atual de Status; quando o usuário escolher "Todos", cancelados serão tratados como Pendentes neutros (ou podemos ocultá-los do agrupamento). **Decisão proposta:** cancelados ficam fora dos 3 grupos (não aparecem) quando o filtro de status é "Todos", para manter o foco estratégico. Se o usuário filtrar explicitamente por "Cancelado", caem em Pendentes visualmente. Confirme se preferir incluir cancelados em um 4º grupo.

A classificação é **derivada no cliente** com `useMemo` a partir do `tx` existente — nenhuma mudança em queries, view do Supabase, ou lógica financeira.

## Comportamento dos dropdowns
- **Pendentes**: aberto por padrão na montagem.
- **Vencidos**: fechado por padrão; quando aberto, fecha os outros dois.
- **Pagos**: fechado por padrão; quando aberto, fecha os outros dois.
- Comportamento "accordion exclusivo": apenas um aberto por vez. Implementado com um único estado `openSection: 'pendentes' | 'vencidos' | 'pagos'`.
- Cabeçalho de cada seção mostra: título, contador `(n)`, e soma total em BRL à direita.
- Vencidos com `count > 0` ganha um indicador visual de alerta (chip vermelho no cabeçalho) para chamar atenção mesmo fechado.

## Mudanças de arquivo
Apenas `src/routes/_app/financeiro.tsx`:

1. Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible` e `ChevronDown` de `lucide-react`.
2. Adicionar `useMemo` para derivar `{ pendentes, vencidos, pagos }` a partir de `tx`.
3. Adicionar estado `openSection` com default `'pendentes'`.
4. Substituir o bloco `{tx.length === 0 ? <EmptyState/> : <div>{tx.map(...)}</div>}` por 3 `<Collapsible>` empilhados, cada um renderizando a mesma row atual de transação (extrair para um pequeno componente local `TxRow` para evitar duplicação).
5. Manter `EmptyState` apenas quando os 3 grupos estiverem vazios.
6. Cabeçalho de cada seção segue o estilo `glass rounded-xl` já usado na página.

## Fora de escopo
- Não altera Dashboard, Clientes, Bancos, Calendário, Serviços, Recorrências.
- Não altera queries, view `v_service_summary`, ou regras financeiras.
- Não muda os filtros existentes (Período/Tipo/Status/Cliente) — eles continuam aplicando antes do agrupamento.
- Não altera o modal "Novo lançamento" nem o `PayTransactionDialog`.

## Pergunta de confirmação
Cancelados: ocultar dos 3 grupos (proposta) ou criar um 4º dropdown "Cancelados" no final?
