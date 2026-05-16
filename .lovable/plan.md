Plano aprovado com ajustes — Módulos Recorrências e Aportes/Repasses

Pode seguir com a implementação dos módulos Recorrências e Aportes/Repasses, mantendo a estrutura visual, técnica e funcional proposta, mas com os ajustes abaixo para preservar a lógica financeira correta do Fyn Sinc.

O objetivo desta etapa é finalizar dois módulos importantes da V1:

1. Recorrências/Mensalidades

2. Aportes/Repasses

Esses módulos devem seguir o mesmo padrão visual já usado em Dashboard, Clientes e Financeiro, com dark mode premium, mobile-first, sidebar desktop, bottom nav mobile, componentes reutilizáveis, Supabase, React Query, react-hook-form, zod e RLS por organization_id.

==================================================

1. RECORRÊNCIAS

==================================================

Criar a rota:

src/routes/_app/recorrencias.tsx

Usar a tabela existente:

recurring_contracts

A tabela já possui RLS por organization_id.

--------------------------------------------------

1.1 Listagem

--------------------------------------------------

A tela Recorrências deve conter:

- Header com título "Recorrências"

- Botão "Nova recorrência"

- Cards de resumo no topo

- Tabela responsiva

- Busca

- Filtros

- Ações por linha

Cards de resumo:

1. Total ativo no mês

2. Número de contratos ativos

3. Próximo vencimento

Tabela responsiva com as colunas:

- Cliente

- Descrição

- Serviço, se existir

- Valor

- Frequência

- Próximo vencimento

- Banco padrão

- Status

- Ações

Filtros:

- Busca por descrição

- Busca por cliente

- Filtro por status: ativa, pausada, cancelada

- Filtro por frequência: semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual

No mobile, a tabela deve virar lista de cards com as principais informações e ações acessíveis.

--------------------------------------------------

1.2 Ações por linha

--------------------------------------------------

Cada recorrência deve ter as ações:

1. Gerar transação

2. Editar

3. Pausar/Ativar

4. Excluir

--------------------------------------------------

1.3 Gerar transação

--------------------------------------------------

Ao clicar em "Gerar transação", criar uma financial_transaction com:

- type = 'receita_propria'

- status = 'pendente'

- due_date = next_due_date da recorrência

- client_id vinculado à recorrência

- service_id quando existir

- bank_id padrão da recorrência, quando existir

- recurring_contract_id vinculado, se esse campo existir no schema

- organization_id da organização atual

- valor_bruto = valor da recorrência

- valor_liquido = valor da recorrência

- descrição baseada na descrição da recorrência

- categoria = 'Recorrência' ou 'Mensalidade'

Depois de gerar a transação, avançar o próximo vencimento conforme a frequência.

Frequências:

- semanal: +7 dias

- quinzenal: +15 dias

- mensal: +1 mês

- bimestral: +2 meses

- trimestral: +3 meses

- semestral: +6 meses

- anual: +1 ano

Importante:

A transação gerada pela recorrência deve aparecer no módulo Financeiro como receita própria pendente.

Depois ela deve poder ser marcada como paga usando o fluxo já existente no Financeiro, incluindo:

- banco de recebimento

- data de pagamento

- taxa, se houver

- criação automática de taxa vinculada

- cálculo de valor líquido

Não criar um fluxo paralelo de pagamento para recorrência. Usar o fluxo já existente do Financeiro.

--------------------------------------------------

1.4 Formulário de recorrência

--------------------------------------------------

Abrir o formulário em Drawer/Sheet.

Campos:

- Cliente: obrigatório, select da tabela clients

- Serviço: opcional, select da tabela services se já existir

- Descrição: obrigatório

- Valor: obrigatório

- Frequência: obrigatório

- Data de início: obrigatório

- Próximo vencimento: obrigatório, default igual à data de início

- Banco padrão: opcional, select da tabela banks

- Observações: opcional

- Status: ativa, pausada ou cancelada

Validação com zod.

Ao salvar:

- inserir ou atualizar recurring_contracts

- incluir organization_id da organização atual

- fechar o Sheet

- invalidar queries relacionadas:

  - ['recorrencias']

  - ['dashboard']

  - ['transactions']

--------------------------------------------------

1.5 Regras importantes das recorrências

--------------------------------------------------

- Recorrência ativa pode gerar transação.

- Recorrência pausada não deve gerar transação.

- Recorrência cancelada não deve gerar transação.

- Não gerar duplicidade para o mesmo cliente, descrição e due_date sem confirmação.

- A geração automática agendada fica fora deste escopo.

- Por enquanto, a geração será manual via botão.

==================================================

2. APORTES E REPASSES

==================================================

Criar a rota:

src/routes/_app/aportes.tsx

A tela pode se chamar visualmente:

"Aportes & Repasses"

Mas internamente NÃO usar os tipos 'aporte' e 'repasse'.

Usar os tipos financeiros oficiais do Fyn Sinc:

1. repasse_recebido

2. uso_repasse

Definição:

repasse_recebido:

Quando o cliente envia dinheiro para mídia, ferramenta ou outro uso operacional.

uso_repasse:

Quando a empresa usa esse dinheiro para pagar Google, Meta, fornecedor, ferramenta ou outro terceiro.

Essa diferença é obrigatória para não misturar dinheiro do cliente com receita própria da empresa.

--------------------------------------------------

2.1 Estrutura técnica

--------------------------------------------------

Não criar tabela dedicada para aportes nesta etapa.

Usar financial_transactions com os tipos:

- repasse_recebido

- uso_repasse

Usar a view:

v_client_wallet

Para calcular saldo por cliente e plataforma.

--------------------------------------------------

2.2 Listagem

--------------------------------------------------

A tela Aportes & Repasses deve ter:

- Header com título "Aportes & Repasses"

- Botão "Novo aporte"

- Botão "Usar aporte" ou "Registrar uso de aporte"

- Cards de resumo

- Tabela de saldos por cliente/plataforma

- Tabela de movimentações recentes

- Filtros

Cards de resumo:

1. Total aportado

2. Total utilizado

3. Saldo disponível

4. Clientes com saldo ativo

Tabela de saldos usando v_client_wallet:

- Cliente

- Plataforma

- Total aportado

- Total utilizado

- Saldo disponível

Tabela de movimentações recentes usando financial_transactions:

- Data

- Cliente

- Tipo

- Descrição

- Plataforma

- Fornecedor, quando existir

- Valor

- Banco

- Status

Filtros:

- Cliente

- Plataforma

- Período

- Tipo: aporte recebido ou uso de aporte

No mobile, as tabelas devem virar cards/listas.

--------------------------------------------------

2.3 Nomenclatura na interface

--------------------------------------------------

Na interface, usar nomes amigáveis:

- "Aporte recebido" para type = 'repasse_recebido'

- "Uso de aporte" para type = 'uso_repasse'

- "Saldo disponível" para saldo restante por cliente/plataforma

Botões:

- "Novo aporte"

- "Usar aporte"

Evitar o botão "Novo repasse", porque pode gerar confusão.

--------------------------------------------------

2.4 Formulário "Novo aporte"

--------------------------------------------------

Abrir em Drawer/Sheet.

Campos:

- Cliente: obrigatório

- Banco de destino: obrigatório

- Plataforma: obrigatório, texto livre ou select simples

  Exemplos:

  - Google Ads

  - Meta Ads

  - TikTok Ads

  - LinkedIn Ads

  - Ferramenta

  - Outro

- Valor: obrigatório

- Data: obrigatório

- Descrição: obrigatório

- Observações: opcional

Ao salvar, inserir em financial_transactions com:

- type = 'repasse_recebido'

- status = 'pago'

- paid_at = data informada

- due_date = data informada

- valor_bruto = valor

- valor_liquido = valor

- client_id obrigatório

- bank_id obrigatório

- platform preenchida

- descricao preenchida

- organization_id da organização atual

Regra financeira:

repasse_recebido aumenta o saldo do banco e aumenta o saldo de repasse do cliente, mas NÃO entra como receita própria da empresa.

--------------------------------------------------

2.5 Formulário "Usar aporte"

--------------------------------------------------

Abrir em Drawer/Sheet.

Campos:

- Cliente: obrigatório

- Plataforma: obrigatório

- Saldo disponível: mostrar em tempo real ao escolher cliente + plataforma

- Banco de origem: obrigatório quando o valor sair de banco

- Fornecedor: opcional

  Exemplos:

  - Google Ads

  - Meta Ads

  - Kommo

  - Hostinger

  - Outro

- Valor: obrigatório

- Data: obrigatório

- Descrição: obrigatório

- Observações: opcional

Ao salvar, inserir em financial_transactions com:

- type = 'uso_repasse'

- status = 'pago'

- paid_at = data informada

- due_date = data informada

- valor_bruto = valor

- valor_liquido = valor

- client_id obrigatório

- bank_id obrigatório quando sair de banco

- platform preenchida

- fornecedor opcional

- descricao preenchida

- organization_id da organização atual

Regra financeira:

uso_repasse reduz o saldo do banco e reduz o saldo de repasse disponível do cliente, mas NÃO entra como despesa própria comum.

--------------------------------------------------

2.6 Validação de saldo

--------------------------------------------------

No formulário "Usar aporte", ao escolher cliente + plataforma, consultar v_client_wallet e mostrar o saldo disponível.

Se o valor informado for maior que o saldo disponível, bloquear o submit na V1.

Mensagem de erro:

"Saldo insuficiente para esta plataforma. Registre um novo aporte antes de usar esse valor."

Não permitir saldo negativo na V1.

Essa regra é obrigatória para manter o controle correto dos valores de cliente.

--------------------------------------------------

2.7 View v_client_wallet

--------------------------------------------------

Garantir que v_client_wallet calcule:

saldo = total de repasse_recebido pago - total de uso_repasse pago

Agrupar por:

- organization_id

- client_id

- platform

A view deve retornar:

- organization_id

- client_id

- client_name

- platform

- total_aportado

- total_usado

- saldo_disponivel

Somar apenas transações com status = 'pago'.

--------------------------------------------------

2.8 Dashboard

--------------------------------------------------

Garantir que o dashboard respeite estas regras:

- repasse_recebido NÃO entra em receita própria

- uso_repasse NÃO entra em despesa própria

- repasse_recebido pode aparecer em cards operacionais como "Repasses recebidos"

- uso_repasse pode aparecer em cards operacionais como "Aportes utilizados"

- saldo disponível deve aparecer como dinheiro de cliente ainda não utilizado

==================================================

3. COMPONENTES COMPARTILHADOS

==================================================

Adicionar ou reaproveitar componentes compartilhados:

- StatusBadge

- EmptyState

- MetricCard

- DataTable

- ConfirmDialog

- Sheet/Drawer de formulário

- PeriodFilter

- formatCurrency

- formatDate

- addPeriod(date, freq)

Criar helper:

addPeriod(date, freq)

Para calcular o próximo vencimento das recorrências.

O helper precisa suportar:

- semanal

- quinzenal

- mensal

- bimestral

- trimestral

- semestral

- anual

==================================================

4. DETALHES TÉCNICOS

==================================================

Usar:

- @tanstack/react-query

- useQuery

- useMutation

- Supabase client

- react-hook-form

- zod

- shadcn/ui sheet

- shadcn/ui table

- shadcn/ui select

- shadcn/ui button

- shadcn/ui input

- shadcn/ui badge

Seguir o mesmo padrão já usado em:

- clientes.tsx

- financeiro.tsx

Sempre incluir organization_id via getCurrentOrgId() nos inserts.

Mutations devem invalidar as queries afetadas:

- ['recorrencias']

- ['aportes']

- ['wallet']

- ['transactions']

- ['dashboard']

- ['clients']

- ['banks']

Não usar serverFn nesta etapa se as telas atuais já estão usando Supabase client direto com RLS.

Manter o padrão atual do projeto.

==================================================

5. SEGURANÇA E RLS

==================================================

Todas as operações precisam respeitar RLS por organization_id.

Nenhuma query deve buscar dados fora da organização atual.

Todos os inserts devem incluir organization_id da organização atual.

Todos os selects de clients, banks, services e financial_transactions devem retornar apenas dados da organização atual.

Não expor dados de outras organizações.

Não criar tabela sem RLS.

==================================================

6. FORA DESTE ESCOPO

==================================================

Não implementar agora:

- Planos/Ferramentas

- Serviços como módulo completo, se ainda não estiver pronto

- Bancos como módulo completo, se ainda não estiver pronto

- Configurações

- Seed de demonstração

- Arquivos/Storage

- Cartões

- Freelancers

- Usuários e papéis

- Geração automática agendada de recorrências

A geração de recorrências nesta etapa será manual via botão.

==================================================

7. RESULTADO ESPERADO

==================================================

Ao final desta etapa, o sistema deve ter:

1. Tela Recorrências funcional

2. Cadastro e edição de recorrências

3. Geração manual de transação financeira a partir da recorrência

4. Avanço automático do próximo vencimento

5. Tela Aportes & Repasses funcional

6. Registro de aporte recebido

7. Registro de uso de aporte

8. Saldo disponível por cliente e plataforma

9. Bloqueio de uso maior que o saldo disponível

10. Dashboard respeitando a separação entre receita própria e dinheiro de cliente

O ponto mais importante:

Não misturar dinheiro do cliente com receita própria da empresa.

No Fyn Sinc:

- Receita própria é dinheiro da empresa.

- Repasse recebido é dinheiro do cliente em custódia.

- Uso de repasse é utilização desse dinheiro.

- Saldo de repasse é o que ainda resta disponível para uso do cliente.