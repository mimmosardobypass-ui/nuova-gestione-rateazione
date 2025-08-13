-- Add optional columns to installments table
ALTER TABLE installments 
ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS receipt_url text;

-- Create view for installment status calculation
CREATE OR REPLACE VIEW v_installments_status AS
SELECT
  i.id,
  i.rateation_id,
  i.seq,
  i.amount,
  i.due_date,
  i.is_paid,
  i.paid_at,
  i.canceled_at,
  i.notes,
  i.payment_method,
  i.receipt_url,
  i.postponed,
  i.owner_uid,
  CASE
    WHEN i.canceled_at IS NOT NULL THEN 'cancelled'
    WHEN i.is_paid THEN 'paid'
    WHEN i.due_date < current_date THEN 'overdue'
    WHEN i.due_date = current_date THEN 'due_soon'
    ELSE 'unpaid'
  END as status,
  GREATEST(0, (current_date - i.due_date))::int as days_late
FROM installments i
WHERE owner_uid = auth.uid();

-- Create enhanced summary view for rateations
CREATE OR REPLACE VIEW v_rateations_summary_enhanced AS
WITH inst_status AS (
  SELECT 
    rateation_id,
    COUNT(*) as total_installments,
    COUNT(*) FILTER (WHERE status = 'paid') as paid_installments,
    COUNT(*) FILTER (WHERE status IN ('unpaid', 'due_soon', 'overdue')) as unpaid_installments,
    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_installments,
    COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as paid_amount,
    COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount,
    COALESCE(SUM(amount), 0) as total_amount_calculated
  FROM v_installments_status
  GROUP BY rateation_id
)
SELECT
  r.id,
  r.number,
  r.type_id,
  rt.name as type_name,
  r.taxpayer_name,
  r.total_amount,
  r.status as rateation_status,
  r.owner_uid,
  COALESCE(inst.paid_amount, 0) as amount_paid,
  COALESCE(inst.overdue_amount, 0) as amount_overdue,
  r.total_amount - COALESCE(inst.paid_amount, 0) as amount_residual,
  COALESCE(inst.total_installments, 0) as installments_total,
  COALESCE(inst.paid_installments, 0) as installments_paid,
  COALESCE(inst.unpaid_installments, 0) as installments_unpaid,
  COALESCE(inst.overdue_installments, 0) as installments_overdue
FROM rateations r
LEFT JOIN rateation_types rt ON rt.id = r.type_id
LEFT JOIN inst_status inst ON inst.rateation_id = r.id
WHERE r.owner_uid = auth.uid();