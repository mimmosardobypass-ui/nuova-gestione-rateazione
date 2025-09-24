## Anti-Regression Checklist

**Mandatory Checks (All Required):**
- [ ] 🔄 Bump cache key: `npm run cache:bump "reason"` if view/schema changed
- [ ] ✅ Tests pass: `npm run test` + `npm run e2e:headless` 
- [ ] 🔍 Smoke SQL: `npm run smoke:sql` passes
- [ ] 📝 Changelog: View version history updated (v1→v2) if applicable

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