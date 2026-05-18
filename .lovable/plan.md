## Revisão de Segurança — Fyn Sinc

Plano incremental, sem alterar identidade visual nem lógica financeira. Cada bloco é independente e pode ser implementado em ondas.

### Diagnóstico atual (o que já está OK)

- RLS ativo em todas as 11 tabelas de `public` (banks, clients, client_documents, financial_transactions, organizations, organization_users, recurring_contracts, services, third_party_plans, trial_requests, user_global_roles).
- Políticas baseadas em `is_org_member(organization_id)` + `is_org_active(...)` e bypass por `is_super_admin`.
- Bucket `client-documents` é privado, com policies por `organization_id` no path; `client-logos` é público (apenas branding visual — aceitável).
- `_app` e `/admin` já têm `beforeLoad` que valida sessão e papel.
- Service role key só usada em `client.server.ts` (server-only) — não vaza no bundle do client.
- Clientes já são persistidos em `clients` via Supabase (não há mock/localStorage de dados de cliente).

### Pontos de risco encontrados (o que será corrigido)

1. **`client_documents.file_url` armazena Signed URL** (`client-dossier.tsx:1152`). Signed URL tem expiração e vaza o token. Deve guardar só `file_path` e gerar signed URL on-demand.
2. **Validações de formulário sem Zod** — `ClientForm`, lançamentos financeiros, recorrências, aportes e upload de documento usam validação manual frouxa. Falta limites de tamanho, regex, schemas reutilizáveis.
3. **Upload sem allow-list de MIME/tamanho** — `client-dossier.tsx` e `client-logo-upload.tsx` aceitam qualquer arquivo. Falta bloquear `.exe/.js/.html/.php/...`, limite de 10MB e validação de extensão coerente com MIME.
4. **Acesso direto por URL em `/clientes/:id`** não mostra "Acesso negado" amigável — hoje a query retorna vazio e a tela quebra. Falta tratamento explícito de "not found / sem permissão".
5. **React Query keys sem `organization_id`** — risco de cache misturar dados ao trocar de org no futuro. Padronizar keys com `organizationId`.
6. **`trial_requests` sem policy de INSERT** — formulário público de trial pode estar usando admin client; revisar para garantir que o insert público vá por server function controlada.
7. **`is_org_member` não checa `status='active'`** (apenas existência de vínculo). Membros suspensos/removidos podem ainda ler dados. Endurecer a função.
8. **Constraints faltantes no banco**: `CHECK` em `client_status`, `financial_status`, `amount >= 0`, índices por `(organization_id, ...)` em `clients`, `financial_transactions(due_date, status)`, `client_documents(client_id)`.
9. **`brand_color` aceita qualquer string** — validar HEX no banco (CHECK regex) e no front (já existe `isValidHex`, falta enforçar no submit).
10. **`getCurrentOrgId` usa `localStorage`** como cache de org — ok como hint, mas toda query precisa **sempre** filtrar `organization_id` da sessão real (RLS já protege, mas reforçar no app).

### Ondas de implementação

**Onda 1 — Banco (migration única)**
- Endurecer `is_org_member` para exigir `status='active'`.
- Adicionar CHECK constraints: `client_status IN ('ativo','inativo')`, `financial_status IN ('em_dia','inadimplente')`, `clients.brand_color ~ '^#[0-9A-Fa-f]{6}$'`, `financial_transactions.amount_gross >= 0`.
- Adicionar política INSERT em `trial_requests` (anon allowed, com rate-limit lógico depois) ou confirmar que insert vai por server function.
- Índices: `clients(organization_id, name)`, `financial_transactions(organization_id, due_date, status)`, `financial_transactions(organization_id, client_id)`, `client_documents(organization_id, client_id)`, `recurring_contracts(organization_id, next_due_date)`.

**Onda 2 — Documentos privados corretos**
- Em `client-dossier.tsx`, parar de salvar `signed_url` em `file_url`. Salvar apenas `file_path`. Gerar signed URL (1h) só na hora de abrir/baixar.
- Migration: zerar `file_url` legado (ou ignorar e ler sempre por `file_path`).
- Allow-list de MIME no upload: `application/pdf`, `image/png|jpeg|webp`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Limite 10MB. Mensagem amigável.

**Onda 3 — Validação com Zod**
- Criar `src/lib/schemas/` com schemas: `clientSchema`, `transactionSchema`, `recurringSchema`, `documentUploadSchema`, `bankSchema`, `serviceSchema`.
- Aplicar nos `onSubmit` de `ClientForm`, `financeiro.tsx`, `recorrencias.tsx`, `aportes.tsx`, `bancos.tsx`, `servicos.tsx`, uploads do dossier.
- Validar `client_id`/`bank_id` pertencem à org antes do submit (consulta rápida).
- Aporte: bloquear submit se uso > saldo (revalidar no submit, não só na UI).

**Onda 4 — Proteção de rotas e acesso direto**
- `ClientDossier`: tratar caso `client` retorna `null` (cliente inexistente ou de outra org via RLS) — exibir tela "Você não tem permissão para acessar este registro" com botão voltar.
- Em `_app.tsx`, garantir que `ready=false` não rasteja dados antes de validar `current org`.
- Adicionar tela `/sem-organizacao` amigável para usuário logado sem vínculo ativo.

**Onda 5 — React Query keys por org**
- Padronizar todas as queries: `['clients', orgId]`, `['client', orgId, clientId]`, `['transactions', orgId, filters]`, `['documents', orgId, clientId]`, etc.
- No futuro switch de org, chamar `qc.removeQueries()` da org anterior. Já preparar helper `invalidateOrgScope(orgId)` em `client-cache.ts`.

**Onda 6 — Hardening e auditoria**
- Remover `console.log` que despejam objetos completos de transação/documento.
- `error-capture.ts`: não logar payloads sensíveis.
- Confirmar que nenhum `process.env.SUPABASE_SERVICE_ROLE_KEY` vaza para o bundle (já confirmado, manter teste).

### Fora de escopo desta etapa

- Painel `/admin` global e métricas: apenas garantir bloqueio para não-super_admin (já feito).
- Tabela `admin_audit_logs`: criar só quando começar a usar.
- Tabelas `recurring_occurrences`, `cashbacks`, `payment_fees`, `subscriptions`, `plans`, `credit_cards`, `trial_invites`: não existem hoje — serão tratadas quando criadas.
- Não tocar em cálculos financeiros (receita/despesa/repasse/cashback/comissão) — apenas validações de input.

### Checklist final (será verificado ao terminar)

- [ ] RLS endurecido com `status='active'`.
- [ ] CHECK constraints + índices aplicados.
- [ ] `client_documents` não guarda signed URL.
- [ ] Upload com allow-list + limite de tamanho.
- [ ] Todos formulários com Zod.
- [ ] Tela "acesso negado" no dossier.
- [ ] Query keys por org.
- [ ] Nenhum dado sensível em `localStorage` (só `current_org`, `remember`, `session_expires_at` — não-sensíveis).
- [ ] `service_role_key` segue só em `client.server.ts`.

Quer que eu comece pela **Onda 1 (migration)** ou prefere outra ordem?
