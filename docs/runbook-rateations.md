# Runbook: Rateations Data Issues

## Health Check Alert

When the **"Verifica dati necessaria"** banner appears:

### 1. Immediate Investigation

```sql
-- Find suspicious rows (installments paid but amount = 0)
SELECT id, number, taxpayer_name, installments_paid, paid_amount_cents, status
FROM v_rateations_list_ui 
WHERE installments_paid > 0 AND paid_amount_cents = 0
ORDER BY updated_at DESC;
```

### 2. Data Integrity Checks

```sql
-- Check total vs components balance
SELECT count(*) as violations
FROM v_rateations_list_ui
WHERE paid_amount_cents + residual_effective_cents > total_amount_cents;

-- Check installment consistency 
SELECT count(*) as inconsistent
FROM v_rateations_list_ui
WHERE installments_paid > installments_total;
```

### 3. Root Cause Analysis

**Common causes:**
- Installments table out of sync with payments
- Manual data entry errors
- Migration/import issues
- Race conditions in payment processing

**Check recent changes:**
```sql
SELECT * FROM v_rateations_list_ui 
WHERE updated_at > NOW() - INTERVAL '24 hours'
AND (installments_paid > 0 AND paid_amount_cents = 0);
```

### 4. Resolution Steps

1. **Immediate**: Check if it's a display issue (refresh cache)
2. **Data Fix**: Update installment payments or reset counters
3. **Prevention**: Review data entry processes

### 5. Escalation

- **< 5% of data**: Monitor, investigate during business hours
- **> 5% of data**: Immediate escalation to data team
- **> 20% of data**: Stop data entry, emergency investigation

## Contact Information

- **Data Team**: data-team@company.com
- **On-call**: +39 XXX XXX XXXX
- **Escalation**: CTO/Head of Engineering

## Monitoring Queries

Run these in Supabase dashboard or your monitoring system:

```sql
-- Daily health check
SELECT 
  COUNT(*) as total_rateations,
  COUNT(*) FILTER (WHERE installments_paid > 0 AND paid_amount_cents = 0) as suspicious,
  ROUND(
    COUNT(*) FILTER (WHERE installments_paid > 0 AND paid_amount_cents = 0) * 100.0 / COUNT(*), 
    2
  ) as suspicious_percentage
FROM v_rateations_list_ui;
```