# Developer Notes - Rateations Feature

## File Map & Responsibilities

### Features Structure
- `features/rateations/types.ts` - All TypeScript interfaces (Rateation, Installment, etc.) - DO NOT duplicate types elsewhere
- `features/rateations/api/rateations.ts` - Supabase CRUD operations for rateations - NO business logic here
- `features/rateations/api/installments.ts` - RPC calls for installments (mark paid, postpone) - ONLY API calls
- `features/rateations/hooks/useRateations.ts` - Data fetching/mutation logic - NO UI code
- `features/rateations/hooks/useRateationTypes.ts` - Types management logic - KEEP simple
- `features/rateations/components/NewRateationDialog.tsx` - Create rateation modal - MAX 150 lines
- `features/rateations/components/RateationsTable.tsx` - Data table display - NO API calls
- `features/rateations/components/RateationFilters.tsx` - Filter controls - Extract from main page
- `features/rateations/components/RateationRowDetails.tsx` - Row expansion details - NO changes needed
- `features/rateations/components/EditRateationModal.tsx` - Edit modal - NO changes needed

### Pages
- `pages/RateationsPage.tsx` - Layout only - MAX 80 lines, NO business logic

## API Contracts

### RPC Functions
- `fn_create_rateation_auto(p_number, p_type_id, p_taxpayer_name, p_start_due_date, p_frequency, p_num_installments, p_amount_per_installment)` → returns bigint
- `fn_create_rateation_manual(p_number, p_type_id, p_taxpayer_name, p_installments_json)` → returns bigint
- `fn_set_installment_paid(p_rateation_id, p_seq, p_paid, p_paid_at)` → void
- `fn_postpone_installment(p_rateation_id, p_seq, p_new_due)` → void

### Supabase Tables
- `rateations` - Main records with owner_uid RLS
- `installments` - Rate details with owner_uid RLS
- `rateation_types` - Lookup table

## LOVABLE Markers Available

### NewRateationDialog.tsx
- `LOVABLE:START saveAuto` / `LOVABLE:END saveAuto`
- `LOVABLE:START saveManual` / `LOVABLE:END saveManual`
- `LOVABLE:START tabContent` / `LOVABLE:END tabContent`
- `LOVABLE:START formFields` / `LOVABLE:END formFields`

### RateationsTable.tsx
- `LOVABLE:START dataFetching` / `LOVABLE:END dataFetching`
- `LOVABLE:START columns` / `LOVABLE:END columns`
- `LOVABLE:START actions` / `LOVABLE:END actions`

### API Files
- Each function wrapped in `LOVABLE:START functionName` / `LOVABLE:END functionName`

## Build/Test Checklist

1. `npm run typecheck` - Zero TypeScript errors
2. `npm run lint` - Zero ESLint warnings
3. Test navigation `/rateazioni?new=1` opens modal
4. Test auto rateation creation
5. Test manual rateation creation with custom amounts/dates
6. Test RLS policies (different users see only their data)
7. Verify all imports use new feature structure

## Request Templates

### Targeted Read
```
Read ONLY: src/features/rateations/components/NewRateationDialog.tsx, src/features/rateations/api/rateations.ts, docs/DEV_NOTES.md
```

### Minimal Patch
```
File: src/features/rateations/components/NewRateationDialog.tsx
Section: LOVABLE:START saveManual … LOVABLE:END saveManual
Objective: [specific change]
Show only the diff of the block.
```

### Multiple Isolated Changes
```
Changes:
1. types.ts: add field X
2. RateationsTable.tsx – LOVABLE:START columns: add column Y
3. api/rateations.ts – LOVABLE:START mapStatus: implement Z
Provide three separate diffs.
```