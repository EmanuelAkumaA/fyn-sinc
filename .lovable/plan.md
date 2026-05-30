## Plano: Equipe & Prestadores (V1)

Módulo novo, sem alterar Calendário, Auth, RLS existente, fluxo geral de Clientes/Serviços/Bancos, regras de aporte/repasse, cashback/taxas, Admin, trial. Reusa o Financeiro como fonte oficial de pagamento. Implementação incremental.

---

### Fase 1 — Banco de dados (migration única)

Novas tabelas em `public`, com `GRANT` + RLS por organização (padrão das demais tabelas: `is_org_member` / `is_org_active` / `super_admin`).

**`providers`**
- Campos conforme spec (id, organization_id, name, provider_type, document, email, phone, pix_key, payment_notes, status default 'ativo', notes, timestamps).
- Validação de `provider_type` e `status` via CHECK simples (valores imutáveis).
- Trigger `set_updated_at`.

**`provider_assignments`**
- Campos conforme spec; FKs lógicas para `providers`, `clients`, `services`, `recurring_contracts`.
- CHECKs: `assignment_type ∈ {pontual,recorrente}`, `compensation_type ∈ {valor_fixo,porcentagem}`, `percentage BETWEEN 0 AND 100`, `fixed_amount >= 0`, `frequency` em lista permitida.
- Regra (CHECK): se `valor_fixo` → `fixed_amount NOT NULL`; se `porcentagem` → `percentage NOT NULL`.

**`provider_payables`**
- Campos conforme spec + FK opcional para `financial_transactions(id)` com `ON DELETE SET NULL`.
- CHECK status, `amount >= 0`.
- Index parcial UNIQUE para evitar duplicidade recorrente: `(provider_assignment_id, reference_month)` quando ambos não nulos.
- UNIQUE em `financial_transaction_id` (parcial WHERE NOT NULL) para garantir 1:1.

**Alteração leve em `financial_transactions`**
- Adicionar coluna `provider_payable_id uuid NULL` (sem FK rígida para evitar ciclo) + index.
- Trigger `sync_provider_payable_on_tx` (espelhando o existente `sync_expense_occurrence_on_tx`):
  - Quando tx vinculada vira `pago`: setar payable.status='paga', `paid_at`, `bank_id`.
  - Quando volta para `pendente`: payable.status='lancada', limpar `paid_at`.
- Trigger `unlink_tx_on_payable_delete` (espelha o de expense).

**Integração com Despesas & Planejamento**
- Adicionar `provider_payable_id uuid NULL UNIQUE` em `expense_occurrences` para permitir vínculo opcional sem duplicar lançamento (a aba Despesas lê via JOIN e marca origem "Prestador" quando preenchido).

**Views**
- `v_provider_summary` (por prestador): custo recorrente, pendente, atrasado, pago no período, totais, contagem de clientes/serviços vinculados.
- `v_client_profitability_summary` e `v_service_profitability_summary`: receitas (excluindo `repasse_recebido`), custos de prestador previstos/pagos, outras despesas próprias pagas, taxas, cashback, lucro e margem previsto/realizado.

Todas as views: `SECURITY INVOKER` (respeitam RLS das tabelas base) + `GRANT SELECT TO authenticated`.

---

### Fase 2 — Helpers e tipagem

- `src/lib/providers.ts`: enums (`PROVIDER_TYPE_LABELS`, `ASSIGNMENT_TYPE`, `COMPENSATION_TYPE`), schemas Zod, helpers de cálculo (lucro/margem previsto e realizado, equivalente mensal reutilizando `monthlyEquivalent` de `expenses.ts`), util de geração de próxima obrigação (reusa `addFrequency`/`computeFirstDueDate`).
- Após a migration, o `src/integrations/supabase/types.ts` será regenerado automaticamente — sem edição manual.

---

### Fase 3 — Rota e navegação

- Criar `src/routes/_app/equipe-prestadores.tsx` (autenticada, padrão das outras `_app/*`).
- Adicionar item no `NAV` e em `MORE_ITEMS` de `src/components/app-sidebar.tsx` (ícone `Users` do lucide-react), entre "Aportes/Repasses" e "Despesas & Planejamento".

---

### Fase 4 — Tela principal Equipe & Prestadores

- Cabeçalho + subtítulo conforme spec.
- Cards superiores: ativos, custo recorrente mensal, previstos no mês, pendentes, pagos no mês, em atraso (via `v_provider_summary` agregada).
- Filtros (tipo / status / com pendências) + busca (nome/documento/telefone/email).
- Grid responsivo de cards de prestador (`MetricCard` style, mas componente próprio `ProviderCard`).
- Botão "Novo prestador" → Sheet com formulário Zod.
- Estados vazios conforme spec.

---

### Fase 5 — Dossiê do prestador

Dialog grande no desktop, fullscreen no mobile (padrão `client-dossier.tsx`).

Header com dados + botão editar. Cards de totais. Abas:
1. **Visão geral** — resumo, próximos pagamentos, últimas movimentações, clientes/serviços vinculados, alertas de atraso.
2. **Vínculos** — lista de `provider_assignments` com preview de margem; ações: editar, pausar, encerrar, gerar obrigação, abrir cliente/serviço. Botão "Novo vínculo".
3. **Pagamentos** — `provider_payables` filtráveis (período/status/cliente/serviço). Ações: "Lançar no Financeiro" / "Ver no Financeiro" / Cancelar / Gerar próxima.
4. **Timeline** — agregação em memória (criado, vínculos, obrigações, lançamentos, baixas, pausas).
5. **Observações** — textarea simples.

---

### Fase 6 — Formulário de vínculo

Reutilizável a partir do dossiê do prestador, do cliente e do serviço.
- Selects de Prestador / Cliente / Serviço / Contrato recorrente do cliente.
- Tipo (pontual/recorrente), compensação (fixo/percentual), frequência, datas.
- Preview de cálculo (receita prevista vs custo vs lucro vs margem). Quando receita não disponível, permitir preenchimento manual apenas para simulação (não persiste como receita).
- Ao salvar pontual: cria 1 `provider_payable` (`nao_lancada`).
- Ao salvar recorrente: cria a obrigação da competência atual; botões "Gerar próxima" e "Gerar obrigações do mês" (com proteção contra duplicidade via unique index).

---

### Fase 7 — Lançar no Financeiro / Baixa

- Server fn / mutation client-side: cria `financial_transactions` (`type=despesa_propria`, `status=pendente`, copia descrição/valor/due_date/bank, vincula `provider_payable_id`, `provider_id`, `client_id`, `service_id`). Atualiza payable para `lancada` + `launched_at`. Idempotente: se já tem `financial_transaction_id`, retorna o existente.
- Baixa: somente pelo módulo Financeiro (fluxo existente). Trigger SQL espelha status → payable.

---

### Fase 8 — Integração com Despesas & Planejamento

- `despesas-planejamento.tsx`: incluir leitura adicional dos `provider_payables` (via view ou JOIN) com origem "Prestador", sem criar `expense_occurrence` paralela. Se a Despesa já tiver `provider_payable_id`, mostrar como único item com badge "Prestador".
- Não duplicar contagem.

---

### Fase 9 — Ajustes compactos em outras telas

- **Cliente (`clientes.$id.tsx`)**: bloco recolhível "Custos de execução" (custos previstos/pagos, lucro previsto/realizado, margens, prestadores vinculados). Lê de `v_client_profitability_summary` + lista enxuta.
- **Serviço (`servicos.tsx` dossiê)**: mesma ideia via `v_service_profitability_summary`.
- **Dashboard (`dashboard.tsx`)**: um único bloco "Equipe & execução" (custos no mês, pendentes, em atraso, margem média realizada) + botão "Ver equipe e prestadores". Inserido após composição de bancos, sem mexer no Calendário Financeiro.

---

### Fase 10 — React Query

- Chaves novas: `['providers', orgId]`, `['provider', orgId, id]`, `['provider-summary', orgId]`, `['provider-assignments', orgId, providerId]`, `['provider-payables', orgId, filters]`.
- Invalidar essas + `['transactions']`, `['expense-planning']`, `['client-summary', clientId]`, `['service-summary', serviceId]`, `['dashboard']`, `['banks']` em cada mutação (criar/editar prestador, criar/editar vínculo, gerar obrigação, lançar no Financeiro, pagar/estornar via Financeiro).

---

### Fora de escopo (V1)

Folha CLT, encargos, férias, ponto, portal prestador, aprovação, comissão multinível, WhatsApp, pagamentos/Pix automáticos, integração bancária, cron externo, PDF avançado.

---

### Detalhes técnicos relevantes

- Enum `transaction_type` já contém `despesa_propria` (confirmado em `types.ts`).
- Tabelas existentes não têm FKs declaradas (padrão do projeto) — manteremos o mesmo estilo nas novas para consistência.
- RLS reusa funções `is_org_member`, `is_org_active`, `is_super_admin` já existentes — sem novas security definer functions necessárias.
- Triggers novos seguem o padrão de `sync_expense_occurrence_on_tx` (SECURITY DEFINER, search_path=public).
- Sem `service_role_key` no frontend; queries diretas via `supabase` client com RLS.

---

### Ordem de execução proposta

1. Migration (tabelas, triggers, views, alteração em `financial_transactions` e `expense_occurrences`).
2. Helpers + tipos (`src/lib/providers.ts`).
3. Rota + menu.
4. Lista + dossiê + Sheet de prestador.
5. Vínculos + obrigações + "Lançar no Financeiro".
6. Integração Despesas & Planejamento.
7. Blocos compactos em Cliente / Serviço / Dashboard.

Cada etapa entregável de forma incremental.
