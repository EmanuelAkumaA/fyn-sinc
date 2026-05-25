
CREATE OR REPLACE VIEW public.v_service_summary
WITH (security_invoker = true) AS
WITH paid AS (
  SELECT service_id, organization_id, client_id, amount_gross
  FROM public.financial_transactions
  WHERE type = 'receita_propria' AND status = 'pago' AND service_id IS NOT NULL
),
pending AS (
  SELECT service_id, organization_id, amount_gross, due_date
  FROM public.financial_transactions
  WHERE type = 'receita_propria' AND status = 'pendente' AND service_id IS NOT NULL
),
clients_tx AS (
  SELECT DISTINCT service_id, organization_id, client_id
  FROM public.financial_transactions
  WHERE service_id IS NOT NULL AND client_id IS NOT NULL
),
clients_rec AS (
  SELECT DISTINCT service_id, organization_id, client_id
  FROM public.recurring_contracts
  WHERE service_id IS NOT NULL
),
all_clients AS (
  SELECT * FROM clients_tx
  UNION
  SELECT * FROM clients_rec
),
active_clients AS (
  SELECT DISTINCT service_id, organization_id, client_id
  FROM public.recurring_contracts
  WHERE status = 'ativo' AND service_id IS NOT NULL
),
rec_mrr AS (
  SELECT
    service_id,
    organization_id,
    COUNT(*) AS active_recurring_count,
    SUM(amount * CASE frequency::text
      WHEN 'semanal' THEN 4
      WHEN 'quinzenal' THEN 2
      WHEN 'mensal' THEN 1
      WHEN 'bimestral' THEN 0.5
      WHEN 'trimestral' THEN 1.0/3
      WHEN 'semestral' THEN 1.0/6
      WHEN 'anual' THEN 1.0/12
      ELSE 1
    END) AS active_mrr
  FROM public.recurring_contracts
  WHERE status = 'ativo' AND service_id IS NOT NULL
  GROUP BY service_id, organization_id
)
SELECT
  s.id AS service_id,
  s.organization_id,
  s.name AS service_name,
  s.type AS service_type,
  s.category,
  s.status,
  s.default_value,
  s.description,
  COALESCE((SELECT COUNT(DISTINCT client_id) FROM active_clients ac WHERE ac.service_id = s.id), 0) AS active_clients_count,
  COALESCE((SELECT COUNT(DISTINCT client_id) FROM all_clients a WHERE a.service_id = s.id), 0) AS total_clients_count,
  GREATEST(
    COALESCE((SELECT COUNT(DISTINCT client_id) FROM all_clients a WHERE a.service_id = s.id), 0)
    - COALESCE((SELECT COUNT(DISTINCT client_id) FROM active_clients ac WHERE ac.service_id = s.id), 0),
    0
  ) AS inactive_clients_count,
  COALESCE((SELECT SUM(amount_gross) FROM paid p WHERE p.service_id = s.id), 0) AS total_revenue,
  COALESCE((SELECT COUNT(*) FROM paid p WHERE p.service_id = s.id), 0) AS paid_transactions_count,
  COALESCE((SELECT SUM(amount_gross) FROM paid p WHERE p.service_id = s.id), 0)
    / NULLIF((SELECT COUNT(*) FROM paid p WHERE p.service_id = s.id), 0) AS average_ticket,
  COALESCE((SELECT SUM(amount_gross) FROM pending pe WHERE pe.service_id = s.id AND pe.due_date < CURRENT_DATE), 0) AS overdue_amount,
  COALESCE((SELECT SUM(amount_gross) FROM pending pe WHERE pe.service_id = s.id), 0) AS pending_amount,
  COALESCE(rm.active_recurring_count, 0) AS active_recurring_count,
  COALESCE(rm.active_mrr, 0) AS active_mrr
FROM public.services s
LEFT JOIN rec_mrr rm ON rm.service_id = s.id;

GRANT SELECT ON public.v_service_summary TO authenticated;
