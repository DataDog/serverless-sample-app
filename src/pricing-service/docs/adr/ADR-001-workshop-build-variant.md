# ADR-001: Workshop Build Variant via `workshop/` Overlay Directory

Date: 2026-03-05
Status: Proposed

## Context

The pricing service lives in a public repository and serves two audiences simultaneously:

1. **CI/CD pipelines** — must deploy a fully working, Datadog-instrumented service and pass integration tests.
2. **Workshop participants** — must clone a broken, uninstrumented service as their starting point for the learning exercise.

The current repo state has the `calculatePricingFunction.ts` adapter as an intentional stub (returns `OK` without real logic or instrumentation). The event handler adapters (`productCreatedPricingHandler.ts`, `productUpdatedPricingHandler.ts`) are working. CI integration tests would fail if they tested the HTTP handler in its current stub form.

Three approaches were evaluated:
- Flag file toggling two parallel implementations per handler
- Long-lived `workshop` git branch diverging from `main`
- Build variant using a `workshop/` source overlay and an env-var build switch

## Decision

Adopt a **build variant** approach:

- Working, instrumented adapter implementations remain at `src/pricing-api/adapters/` (unchanged, the CI default).
- Broken, uninstrumented workshop stubs live at `src/pricing-api/workshop/`.
- The build script (`package.sh` + esbuild configs) selects the source directory based on the `WORKSHOP_BUILD` environment variable (default: unset = CI/production path).
- A `make workshop-build` Makefile target builds the broken workshop version.
- CI never sets `WORKSHOP_BUILD`, so CI always builds and tests the working path.

## Consequences

### Positive
- Single branch, no long-lived divergence or rebase/merge overhead.
- CI is always safe by default — no env var needed, no removal step required.
- Working implementations co-locate with stubs as the reference answer.
- New handlers follow a simple rule: add a working impl to `adapters/`, add a stub to `workshop/`.
- TypeScript compilation of stubs catches interface drift early.

### Negative
- Two implementations per handler must be maintained (stub + working).
- Contributors must remember to add a workshop stub when adding a new adapter.
- Build script gains a small amount of conditional logic.

### Neutral
- Workshop stubs are intentionally thin — they won't carry business logic — so divergence risk is low.
- The `WORKSHOP_BUILD` variable can be extended to select a subdirectory for future multi-level workshop tracks.

## Alternatives Considered

### Flag File (Option A)
A checked-in `workshop.flag` file switches implementations at build time. Rejected because the repo default would need to be the CI state (flag absent), meaning participants would need an extra step to enable the broken mode. The two parallel implementations also create the same maintenance burden as the chosen option without the clear directory structure.

### Git Branch Strategy (Option B)
A `workshop` branch permanently diverges from `main`. Rejected because long-lived branch divergence accumulates merge conflicts in shared config files (package.json, tsconfig, Terraform), requires contributor discipline to keep in sync, and makes it harder to show participants the reference answer in context.

## Related Decisions
None (first ADR for this service).

## Notes
- The `workshop/` stubs should import only `aws-lambda` types (no `dd-trace`, no domain services) to keep them clearly uninstrumented.
- A `git tag workshop-start` can complement this approach to give participants a clean reference point.
- See full analysis: `docs/design-workshop-broken-vs-working.md`
