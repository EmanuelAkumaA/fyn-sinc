
# Restauração do schema do Fyn Sinc no Supabase externo

## Confirmações iniciais (auditoria)

- O projeto **já aponta** para o Supabase externo novo: `twgcxnoctlkbrtaapxik` (confirmado em `.env`, `supabase/config.toml` e `src/integrations/supabase/client.ts`).
- **Lovable Cloud não será ativado**. Toda a restauração ocorre no Supabase externo já conectado.
- O banco do novo projeto está **vazio** (sem tabelas, triggers ou buckets) — confirmado via metadados.
- O repositório contém **22 migrations** versionadas em `supabase/migrations/` (2026-05-16 → 2026-05-30), totalizando ~1.625 linhas SQL. Elas são a fonte única de verdade do schema.
- Nenhum seed/dado fictício será inserido. Banco ficará estruturalmente completo e limpo.

## Estratégia

Aplicar as 22 migrations em ordem cronológica diretamente no Supabase externo via `supabase--migration` (uma chamada por arquivo, na ordem do timestamp do nome). Não recriar nem refazer schema manualmente — apenas reexecutar o que já está versionado.

Se alguma migration falhar:
1. Parar imediatamente.
2. Diagnosticar a causa (dependência ausente, objeto duplicado, role inexistente, etc.).
3. Aplicar correção mínima preservando nomes de tabelas/colunas usados pelo frontend.
4. Continuar a partir da migration corrigida.
5. Reportar o ajuste ao usuário.

## Etapas

### 1. Aplicar migrations (ordem cronológica)

Sequência exata a executar (uma chamada `supabase--migration` por arquivo, conteúdo lido de `supabase/migrations/`):

```text
20260516205628 → base: organizations, profiles, organization_users, helpers is_org_member/is_org_active/is_super_admin
20260516205813 → ajustes iniciais
20260516220434 → clients
20260516222623 → banks, financial_transactions
20260516234940 → services
20260516235811 → ajustes
20260517015826 → recurring_contracts / occurrences
20260517212015 → ...
20260517213710 → ...
20260518161016 → ...
20260523151448 → ...
20260523193854 → ...
20260523201718 → ...
20260523220612 → ...
20260523221100 → ...
20260523224531 → ...
20260525225616 → ...
20260525230720 → ...
20260525232202 → ...
20260527234951 → ...
20260529233313 → despesas/planejamento
20260530222106 → providers, provider_assignments, provider_payables (Equipe & Prestadores)
```

(Os títulos acima refletem o conteúdo conhecido; o que importa é executar cada arquivo *verbatim* na ordem cronológica.)

### 2. Validação pós-migration

- Rodar `supabase--linter` para detectar problemas (RLS off, search_path, security definer views, etc.) e corrigir os relevantes.
- Listar via `supabase--read_query` tabelas, views, funções e policies criadas — conferir presença de:
  - `organizations`, `organization_users`, `profiles`, `user_global_roles`
  - `clients`, `services`, `banks`
  - `financial_transactions`, `recurring_contracts`, `recurring_occurrences`
  - `client_documents`
  - `expense_categories`, `expense_plans`, `expense_occurrences`
  - `third_party_plans`
  - `providers`, `provider_assignments`, `provider_payables`
  - views: `v_provider_summary`, `v_client_profitability_summary`, `v_service_profitability_summary` e demais views financeiras das migrations.

### 3. Storage

Criar bucket privado `client-documents` no Supabase externo se as migrations não o criarem, com políticas RLS por `organization_id/client_id/filename`:
- upload/leitura/update/delete restritos a membros ativos da organização (via `is_org_member`/`is_org_active`).
- bucket marcado como **privado** (acesso via signed URLs).

### 4. Tipos TypeScript

- Após sucesso das migrations, regenerar `src/integrations/supabase/types.ts` (atualizado automaticamente pela plataforma após cada migration aprovada).
- Conferir que `src/lib/providers.ts`, `src/lib/finance.ts`, etc., continuam compilando.

### 5. Auth

- Não alterar fluxo de Auth existente. Validar que `signup`, `login`, `logout`, recuperação de sessão e criação automática de `profile` + `organization` (via triggers das migrations) funcionam no novo projeto.
- Confirmar provedor Email/Password habilitado no painel do Supabase externo.

### 6. Smoke test (sem deixar dados)

Manual pelo usuário, seguindo o roteiro do item 12 do pedido. Não vou inserir dados de teste automaticamente — apenas deixar o ambiente pronto.

### 7. Relatório final

Após concluir, informar:
- Confirmação de uso exclusivo do Supabase externo `twgcxnoctlkbrtaapxik`.
- Lovable Cloud não ativado.
- 22 migrations aplicadas (lista com status).
- Objetos criados (tabelas/views/funções/triggers/policies).
- Bucket `client-documents` criado e políticas aplicadas.
- Avisos do linter resolvidos vs. pendentes.
- Próximos passos (recadastro manual).

## Premissas / pontos a confirmar

- As migrations no repositório são as **definitivas** (não vou editá-las, apenas executar).
- Caso alguma migration referencie objetos do Auth/Storage que já existam por padrão no novo projeto, ajustes mínimos com `IF NOT EXISTS` / `CREATE OR REPLACE` serão usados como correção pontual.
- Não vou implementar parceiros/revendedores.
- Não vou criar usuários por SQL — signup do app cuida disso.

## Detalhes técnicos

- Ferramenta: `supabase--migration` (uma migration por chamada, conteúdo idêntico ao arquivo).
- Verificações: `supabase--read_query` para inspecionar `information_schema`/`pg_policies` entre etapas se necessário.
- Linter: `supabase--linter` ao final.
- Storage: criado via SQL (`storage.buckets` + `storage.objects` policies) na própria sequência de migrations ou em migration complementar se ausente.

Confirme para eu prosseguir com a execução em modo build.
