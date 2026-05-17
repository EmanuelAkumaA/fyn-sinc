
-- =========================================================
-- 1. CLIENT DOCUMENTS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  client_id uuid NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  related_transaction_id uuid,
  related_recurring_id uuid,
  document_date date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_org ON public.client_documents(organization_id);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members select client_documents" ON public.client_documents
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members insert client_documents" ON public.client_documents
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "org members update client_documents" ON public.client_documents
  FOR UPDATE TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "org members delete client_documents" ON public.client_documents
  FOR DELETE TO authenticated USING (is_org_member(organization_id));

CREATE TRIGGER trg_client_documents_updated_at
  BEFORE UPDATE ON public.client_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. CLIENT FINANCIAL SUMMARY VIEW
-- =========================================================
CREATE OR REPLACE VIEW public.v_client_financial_summary
WITH (security_invoker = true) AS
WITH tx_agg AS (
  SELECT
    t.organization_id,
    t.client_id,
    COALESCE(SUM(CASE WHEN t.type IN ('receita_propria','comissao','cashback') AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_received,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.due_date IS NOT NULL AND t.due_date >= CURRENT_DATE THEN t.amount_gross ELSE 0 END), 0) AS total_receivable,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.due_date IS NOT NULL AND t.due_date <  CURRENT_DATE THEN t.amount_gross ELSE 0 END), 0) AS total_overdue,
    COALESCE(SUM(CASE WHEN t.type = 'receita_propria' AND t.status = 'pendente' AND t.recurring_contract_id IS NULL THEN t.amount_gross ELSE 0 END), 0) AS pending_one_time_amount,
    COALESCE(SUM(CASE WHEN t.type = 'repasse_recebido' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_repasse_received,
    COALESCE(SUM(CASE WHEN t.type = 'uso_repasse'      AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_repasse_used,
    COALESCE(SUM(CASE WHEN t.type = 'comissao' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_commissions,
    COALESCE(SUM(CASE WHEN t.type = 'cashback' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_cashbacks,
    COALESCE(SUM(CASE WHEN t.type = 'taxa'           AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_fees,
    COALESCE(SUM(CASE WHEN t.type = 'despesa_propria' AND t.status = 'pago' THEN t.amount_gross ELSE 0 END), 0) AS total_expenses
  FROM public.financial_transactions t
  WHERE t.client_id IS NOT NULL
  GROUP BY t.organization_id, t.client_id
),
rec_agg AS (
  SELECT
    r.organization_id,
    r.client_id,
    COALESCE(SUM(CASE WHEN r.status = 'ativo' THEN r.amount ELSE 0 END), 0) AS active_recurring_amount,
    COALESCE(SUM(CASE WHEN r.status = 'ativo' AND r.next_due_date IS NOT NULL
                       AND r.next_due_date >= date_trunc('month', CURRENT_DATE)
                       AND r.next_due_date <  (date_trunc('month', CURRENT_DATE) + interval '1 month')
                  THEN r.amount ELSE 0 END), 0) AS expected_recurring_month
  FROM public.recurring_contracts r
  GROUP BY r.organization_id, r.client_id
)
SELECT
  c.organization_id,
  c.id AS client_id,
  COALESCE(tx.total_received,           0) AS total_received,
  COALESCE(tx.total_receivable,         0) AS total_receivable,
  COALESCE(tx.total_overdue,            0) AS total_overdue,
  COALESCE(re.active_recurring_amount,  0) AS active_recurring_amount,
  COALESCE(re.expected_recurring_month, 0) AS expected_recurring_month,
  COALESCE(tx.pending_one_time_amount,  0) AS pending_one_time_amount,
  COALESCE(tx.total_repasse_received,   0) AS total_repasse_received,
  COALESCE(tx.total_repasse_used,       0) AS total_repasse_used,
  COALESCE(tx.total_repasse_received,0) - COALESCE(tx.total_repasse_used,0) AS repasse_balance,
  COALESCE(tx.total_commissions,        0) AS total_commissions,
  COALESCE(tx.total_cashbacks,          0) AS total_cashbacks,
  COALESCE(tx.total_fees,               0) AS total_fees,
  COALESCE(tx.total_expenses,           0) AS total_expenses,
  ( COALESCE(tx.total_received,0)
    - COALESCE(tx.total_fees,0)
    - COALESCE(tx.total_expenses,0)
  ) AS client_net_profit
FROM public.clients c
LEFT JOIN tx_agg tx ON tx.organization_id = c.organization_id AND tx.client_id = c.id
LEFT JOIN rec_agg re ON re.organization_id = c.organization_id AND re.client_id = c.id;

-- =========================================================
-- 3. STORAGE BUCKET (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- path format: {organization_id}/{client_id}/{filename}
CREATE POLICY "org members read client-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members insert client-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members update client-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "org members delete client-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND is_org_member(((storage.foldername(name))[1])::uuid)
  );
