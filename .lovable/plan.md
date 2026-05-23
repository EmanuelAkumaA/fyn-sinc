## Escopo

Quatro ajustes pontuais, todos em frontend (sem mexer em regras/RLS):

### 1. Card do cliente — responsividade no mobile (393px)
Hoje, no `client-card.tsx`, logo + nome + telefone + e-mail + 2 badges + botão "..." ficam todos em uma única linha horizontal. No mobile o nome trunca cedo e os badges/ações ficam apertados.

Mudanças em `src/components/client-card.tsx`:
- Reestruturar para layout em 2 linhas no mobile: linha 1 = logo + nome/empresa + menu de ações; linha 2 = contato (telefone/e-mail) + badges (status + financeiro).
- Em `sm:` voltar ao layout horizontal atual.
- Truncamento correto do nome (sem ser comido pelos badges).

### 2. Espaço da logo do cliente
O `ClientLogo` usa `p-1.5` (padding interno grande) dentro de uma caixa de 44–48px, então logos retangulares ficam minúsculas e com muita borda preta.

Mudanças em `src/components/client-logo.tsx`:
- Reduzir padding interno (`p-0.5` ou nenhum) para a imagem ocupar a caixa.
- Ajustar `backgroundColor` quando há logo para neutro (sem o `rgba(0,0,0,0.25)` que cria moldura preta).
- Manter `object-contain` para não distorcer.

### 3. Excluir cliente a partir do card
Adicionar item "Excluir" no `DropdownMenu` do card (já existe "Editar"). Em `src/routes/_app/clientes.tsx`:
- Nova mutation `remove` (`supabase.from("clients").delete().eq("id", id)`).
- `AlertDialog` de confirmação ("Excluir cliente? Esta ação não pode ser desfeita.") antes de chamar.
- Toast de sucesso/erro e `invalidateQueries(["clients"])`.
- Propagar callback `onDelete` para o `ClientCard` e adicionar `DropdownMenuItem` "Excluir" em vermelho.

### 4. Excluir lançamentos em Financeiro
Hoje em `src/routes/_app/financeiro.tsx` só existe "marcar como pago". Não há ação de excluir.

Mudanças:
- Nova mutation `remove` chamando `supabase.from("financial_transactions").delete().eq("id", id)`.
- Novo botão ícone `Trash2` em cada linha, ao lado do "marcar como pago".
- `AlertDialog` de confirmação.
- Invalidate da query `["transactions"]` no sucesso.

### Itens fora do escopo desta tarefa
- "No PWA" — entendi como "no momento de testar pelo PWA/mobile". Se a intenção for outra (ex.: bug específico do app instalado), me avisa.
- Mexer em backend, RLS ou storage. RLS já permite delete para membros ativos da org nas duas tabelas.

## Detalhes técnicos

- `ClientCard` passa a aceitar `onDelete?: (client) => void`. Quando ausente, o item "Excluir" não aparece.
- Confirmação via `AlertDialog` do shadcn (já presente no projeto). Sem deletes silenciosos.
- Nenhuma migração de banco; RLS atual cobre os deletes.
- Sem alteração em tokens/cores: usar `text-destructive` para os botões de exclusão.