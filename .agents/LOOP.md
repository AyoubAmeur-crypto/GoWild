# .agents/LOOP.md — Implementation Loop & Stop Conditions

## Execution Cycle (Per Milestone)
1. **Inspect**: Read `AGENTS.md`, `.agents/PROGRESS.md`, `.agents/TASKS.md`, `.agents/ISSUES.md`, and the target source files. Verify actual versions in `package.json`.
2. **Scope**: Mark the active vertical slice in `.agents/TASKS.md` with clear, testable acceptance criteria.
3. **Implement**: Build the full vertical slice across domain types, Zod validation, BFF/provider adapter (if applicable), TanStack Query/Zustand state, reusable UI primitives, and thin `src/app/` route bindings. Ensure loading, empty, offline/error, and disabled states are real.
4. **Verify**:
   - Run `npx tsc --noEmit` (zero errors across `src/` and `server/`).
   - Run `npm test` (`node --test` unit + BFF integration tests).
   - Run Metro platform bundle check (`HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios` / `android`) after UI/routing changes.
5. **Remediate**: Fix failures immediately (max 3 bounded attempts per failure; if blocked by sandbox/network/missing external credentials, record exact evidence in `.agents/ISSUES.md`).
6. **Audit**: Cross-check UI against `.agents/DESIGN_SYSTEM.md`, `README/FIGMA_AUDIT.md`, dark mode, touch targets (>= 44pt), and reduced motion.
7. **Document**: Update `.agents/PROGRESS.md`, `.agents/TASKS.md`, `.agents/DECISIONS.md`, and `.agents/ISSUES.md`.

## Hard Stop Conditions
- **Missing External Credentials for Live Production**: Never invent supplier keys (`LITEAPI_KEY`, `DUFFEL_ACCESS_TOKEN`). Implement real adapters, verify contract shapes via automated tests, and report missing live secrets as an explicit blocker for live upstream traffic.
- **Provider Failure**: Never fall back silently to mock fixtures when a live provider errors.
- **Payment Security**: Never render custom raw credit-card PAN/CVV inputs. Use provider-hosted checkout / Payment SDK handoff or documented sandbox test tokens in non-production sandbox mode.
- **Git Safety**: Never run destructive git commands or commit without explicit user authorization.

