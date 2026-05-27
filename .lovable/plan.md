## Cashback em "Usar aporte"

Adiciona controle de cashback nos usos de aporte (geralmente pagos no cartão), permitindo registrar o valor esperado e depois marcar como recebido.

### 1. Banco de dados (migração)

Novos campos em `financial_transactions` (usados apenas em `type = 'uso_repasse'`):

- `cashback_expected` numeric default 0 — valor previsto
- `cashback_received` numeric default 0 — valor efetivamente recebido
- `cashback_received_at` date — data do recebimento
- `cashback_bank_id` uuid — banco onde caiu o cashback
- `cashback_status` text default 'nenhum' — `nenhum | pendente | recebido`

### 2. Formulário "Usar aporte" (`src/routes/_app/aportes.tsx` → `UsoForm`)

Adiciona seção "Cashback (opcional)" sempre visível:
- Campo `Cashback esperado (R$)` — numérico, opcional
- Ao salvar, se `cashback_expected > 0` → `cashback_status = 'pendente'`, senão `'nenhum'`

### 3. Lista de movimentações

Em cada linha de "uso_repasse" com cashback:
- Mostrar chip `Cashback: R$ X esperado` (amarelo) ou `Cashback recebido R$ X` (verde)
- Botão "Receber cashback" abre dialog para informar:
  - Valor recebido (default = esperado)
  - Data
  - Banco de destino
- Ao confirmar: atualiza `cashback_received`, `cashback_received_at`, `cashback_bank_id`, `cashback_status='recebido'` e cria uma transação auxiliar `type='receita'` no banco escolhido para refletir a entrada (mantém saldo bancário coerente).

### 4. Métricas

Novo card no topo: **Cashback pendente** (soma de `cashback_expected - cashback_received` onde status='pendente').

### Fora de escopo

- Não muda fluxo de "Novo aporte"
- Não toca em third_party_plans (que já tem cashback próprio)
- Sem mudanças em Financeiro/Dashboard/Bancos
