## Objetivo
Separar o saldo de **Aportes (recursos de clientes)** do **saldo total** dos bancos. Aportes não pertencem à empresa, então não devem entrar no consolidado nem no saldo exibido como principal de cada banco. Eles ganham um card próprio.

## Mudanças

### 1. `src/lib/finance.ts` — recalcular `total_balance`
Mudar a fórmula em `deriveBreakdown` para **excluir** `repasse_received` e `repasse_used` (aportes de clientes):

```
total_balance = initial + income + commission + cashback + tIn
              - expense - fees - tOut
```

`client_funds_balance` (= repRecv − repUsed) continua existindo como hoje e passa a ser o "saldo de aportes" separado.

Efeito: o número grande mostrado em cada card de banco e o "Saldo consolidado" passam a representar **apenas dinheiro da empresa (Kuma)**.

### 2. `src/routes/_app/bancos.tsx` — novo card de Aportes
- Topo da página: o grid de métricas vira `md:grid-cols-4`:
  1. **Saldo consolidado** (já não inclui aportes)
  2. **Aportes de clientes** *(novo)* — soma de `client_funds_balance` de todos os bancos, com hint "Recursos de terceiros, não compõem o saldo"
  3. **Contas ativas**
  4. **Saldo inicial**
- Em cada card de banco:
  - O valor grande continua mostrando `total_balance` (agora já sem aportes).
  - Logo abaixo do valor, um mini-bloco destacado **"Aportes: R$ X,XX"** quando `client_funds_balance ≠ 0`, visualmente separado dos chips Kuma/Cashback/Taxas.
  - O chip "Aportes" do `BankBreakdownChips` é removido (passa a ser o card próprio).

### 3. `src/components/bank-breakdown-chips.tsx`
Remover o item "Aportes" da lista de chips (fica só Kuma, Cashback, Taxas). Aportes agora têm exibição dedicada acima.

### 4. `src/routes/_app/dashboard.tsx`
Como `total_balance` mudou de semântica, ajustar a métrica **"Saldo em bancos"** para ainda fazer sentido (já não inclui aportes — exatamente o desejado). A variável `aportesSaldo` já existe; vou garantir que a UI deixe claro que aportes estão separados (manter o card de aportes que já existe lá, sem somar no consolidado). Sem mudança de lógica além de remover o chip "Aportes" dos mini-cards de banco do dashboard (mesma alteração do componente `BankBreakdownChips`).

## Fora de escopo
- Views SQL e estrutura do banco (a view `v_bank_balance_breakdown` já entrega `repasse_received_total` e `repasse_used_total` separadamente; só muda o cálculo no client).
- Página Financeiro, Aportes/Repasses, Calendário, autenticação, navegação.
