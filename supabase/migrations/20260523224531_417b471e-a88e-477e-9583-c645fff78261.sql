
CREATE OR REPLACE VIEW public.v_bank_balance_breakdown
WITH (security_invoker = on)
AS
SELECT
  b.id AS bank_id,
  b.organization_id,
  b.name AS bank_name,
  b.account_type AS bank_type,
  b.status,
  b.color,
  b.logo_url,
  b.initial_balance,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='receita_propria'),0) AS income_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='despesa_propria'),0) AS expense_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='comissao'),0) AS commission_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='cashback'),0) AS cashback_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='taxa'),0) AS fees_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='repasse_recebido'),0) AS repasse_received_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='uso_repasse'),0) AS repasse_used_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.transfer_to_bank_id=b.id AND ft.status='pago' AND ft.type='transferencia'),0) AS transfer_in_total,
  COALESCE((SELECT sum(amount_gross) FROM financial_transactions ft WHERE ft.bank_id=b.id AND ft.status='pago' AND ft.type='transferencia'),0) AS transfer_out_total
FROM public.banks b;

-- TODO: a "origem" das transferências (Kuma vs cliente) não é separada nesta etapa.
-- total_balance e kuma_balance/client_funds_balance são derivados no client para evitar nesting de subqueries adicionais.
COMMENT ON VIEW public.v_bank_balance_breakdown IS
'Breakdown de saldo por banco. total_balance = initial + receitas pagas - saidas pagas + transferencias_in - transferencias_out. kuma = income+commission+cashback-expense-fees. client_funds = repasse_received-repasse_used. Transferencias nao sao atribuidas a origem.';
