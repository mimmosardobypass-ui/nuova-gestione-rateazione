# Data Contract - v_rateations_list_ui

## Overview
This document defines the canonical data contract for the `v_rateations_list_ui` database view and its mapping to UI types.

## Schema Version: v7

### Core Fields (in cents)
All monetary values are stored in cents to avoid floating-point precision issues:

- `total_amount_cents`: Total rateation amount (bigint, non-negative)
- `paid_amount_cents`: Amount already paid (bigint, non-negative) 
- `residual_effective_cents`: Remaining amount to pay, excluding interrupted rateations (bigint, non-negative)
- `overdue_effective_cents`: Overdue amount, excluding interrupted rateations (bigint, non-negative)

### Installment Counters
- `installments_total`: Total number of installments (bigint, non-negative)
- `installments_paid`: Number of paid installments (bigint, non-negative)
- `installments_overdue_today`: Number of overdue installments as of today (optional, bigint, non-negative)

### Data Integrity Constraints
1. **Paid Correlation**: If `installments_paid > 0`, then `paid_amount_cents > 0`
2. **Total Consistency**: `paid_amount_cents + residual_effective_cents ≤ total_amount_cents`
3. **Counter Logic**: `installments_paid ≤ installments_total`

## Mapping Rules

### Currency Conversion
```typescript
const € = (cents: number) => cents / 100;
```

### Calculated Fields
- `rateNonPagate = installments_total - installments_paid`
- `importoRitardo = €(overdue_effective_cents)`
- `residuoEffettivo = €(residual_effective_cents)`

## Validation Pipeline

1. **Runtime Validation**: Zod schema validates all incoming data
2. **Health Monitoring**: Detects integrity violations in real-time
3. **Type Safety**: Centralized mapper ensures consistent transformations
4. **Cache Versioning**: Cache key bumped on schema changes

## Breaking Changes Process

1. Create new view version (e.g., `v_rateations_list_ui_v2`)
2. Update schema in `src/schemas/RateationListRow.schema.ts`
3. Update mapper in `src/mappers/mapRateationListRow.ts`
4. Bump cache key in `src/constants/cache.ts`
5. Update unit tests
6. Deploy with feature flag
7. Remove old view after validation

## Health Monitoring

The system monitors for:
- Schema validation failures
- Data integrity violations  
- Performance regression in view queries
- Cache hit/miss ratios

Contact: Development team for schema change requests.