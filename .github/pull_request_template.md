## Anti-Regression Checklist

**Data Contract Changes:**
- [ ] If view `v_rateations_list_ui` changed: bump cache key in `src/constants/cache.ts`
- [ ] If schema/mapping changed: update unit tests in `tests/mapRateationListRow.spec.ts`
- [ ] Zod schema updated if new fields added to `RateationListRowSchema`

**Testing:**
- [ ] Unit tests pass: `npm run test`
- [ ] Contract tests pass: `npm run test:contract` 
- [ ] E2E tests pass: `npm run e2e:headless`
- [ ] Type check passes: `npm run type-check`

**Validation:**
- [ ] Health check tested with suspicious data (if applicable)
- [ ] Error fallbacks tested (network failure, validation failure)
- [ ] No breaking changes to existing RateationRow interface

**Performance:**
- [ ] Cache invalidation strategy considered
- [ ] No new N+1 queries introduced
- [ ] Bundle size impact assessed

## Changes Summary
Brief description of what changed and why.

## Testing Notes
How to test this change locally.