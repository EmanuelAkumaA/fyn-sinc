
ALTER TABLE public.provider_assignments
  ADD COLUMN IF NOT EXISTS first_due_date date,
  ADD COLUMN IF NOT EXISTS installments_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'finite',
  ADD COLUMN IF NOT EXISTS auto_generate_payables boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS launch_behavior text NOT NULL DEFAULT 'planning_only';

ALTER TABLE public.provider_assignments
  DROP CONSTRAINT IF EXISTS provider_assignments_recurrence_mode_check;
ALTER TABLE public.provider_assignments
  ADD CONSTRAINT provider_assignments_recurrence_mode_check
  CHECK (recurrence_mode IN ('finite','continuous'));

ALTER TABLE public.provider_assignments
  DROP CONSTRAINT IF EXISTS provider_assignments_launch_behavior_check;
ALTER TABLE public.provider_assignments
  ADD CONSTRAINT provider_assignments_launch_behavior_check
  CHECK (launch_behavior IN ('planning_only','launch_first','launch_all'));

ALTER TABLE public.provider_assignments
  DROP CONSTRAINT IF EXISTS provider_assignments_installments_check;
ALTER TABLE public.provider_assignments
  ADD CONSTRAINT provider_assignments_installments_check
  CHECK (
    (recurrence_mode = 'continuous')
    OR (installments_count IS NULL)
    OR (installments_count >= 1)
  );

ALTER TABLE public.provider_payables
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installments_total integer;

CREATE UNIQUE INDEX IF NOT EXISTS provider_payables_assignment_installment_uniq
  ON public.provider_payables (provider_assignment_id, installment_number)
  WHERE provider_assignment_id IS NOT NULL AND installment_number IS NOT NULL;
