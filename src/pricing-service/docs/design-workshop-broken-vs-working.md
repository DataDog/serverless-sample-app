# Design: Workshop Broken-vs-Working Service Strategy

Generated: 2026-03-05
Status: Draft

## Problem Statement

### Goal
Maintain two states of the pricing service in a single repository:
1. A **working, instrumented** version that the CI/CD pipelines deploy and test against.
2. A **broken, uninstrumented** version that workshop participants clone and fix as the learning exercise.

### Constraints
- Single repository (no forks per workshop run)
- CI/CD must remain green — integration tests must pass against the working version
- Workshop participants must clone a broken version without additional setup
- The broken state must be realistic enough to be a meaningful workshop challenge (missing Datadog instrumentation + functional bugs)
- Build tooling (`package.sh`, esbuild) must work for both paths

### Success Criteria
- [ ] CI/CD pipelines deploy and pass integration tests against a fully working, instrumented service
- [ ] A fresh `git clone` of the repo gives workshop participants a broken service
- [ ] The mechanism requires no manual switch or secret knowledge to toggle
- [ ] The working state is the authoritative reference for "done" in the workshop
- [ ] Adding new handlers or functions does not require duplication of the mechanism

## Context

### Current State
- `calculatePricingFunction.ts` is a stub that returns `{ statusCode: 200, body: '"OK"' }` — this is the broken workshop version of the HTTP handler.
- `productCreatedPricingHandler.ts` and `productUpdatedPricingHandler.ts` are fully working event handlers with dd-trace spans, semantic conventions, and error handling.
- `pricingService.ts` contains the real pricing logic plus an intentional `issueSimulator` for demonstrating Datadog observability.
- `observability.ts` contains full Datadog span helpers (dd-trace).
- `package.sh` / esbuild build scripts bundle whatever entry points are listed in `build*.js` adapter scripts.
- CI/CD (GitHub Actions) runs `make build` then deploys to ephemeral environments and runs `make integration-test`.

### Related Decisions
None (first ADR for this service).

---

## Alternatives Considered

### Option A: Feature-Flag File (`WORKSHOP_MODE`)

**Summary**: A checked-in file (e.g., `workshop.flag`) or a constant in source controls which implementation is bundled at build time.

**Architecture**:
```
src/pricing-api/adapters/
  calculatePricingFunction.ts       <-- always the entry point
  calculatePricingFunction.impl.ts  <-- real implementation (always present)
  calculatePricingFunction.stub.ts  <-- broken workshop stub (always present)

workshop.flag  <-- present = workshop mode; absent = CI mode
```

`calculatePricingFunction.ts` reads the flag at build time (via a build script shim) and re-exports the correct implementation.

**Pros**:
- Simple to reason about: presence of one file controls behaviour
- No branching strategy complexity
- CI removes the file; workshop participants have the file

**Cons**:
- The flag file must be absent in the repo for CI to work, but workshop participants clone from the repo — CI would need to `rm workshop.flag` before building, meaning the repo default would be "no flag" (CI mode), which is the opposite of what workshop participants need
- To ship the broken version to participants you'd need a separate step (add the flag before they clone), or ship via a different branch/release
- Two parallel implementations live side-by-side indefinitely — maintenance burden grows with each new handler

**Coupling Analysis**:
| Component | Afferent (Ca) | Efferent (Ce) | Instability |
|-----------|--------------|--------------|-------------|
| Flag file | 1 (build script) | 0 | 0.0 (stable) |
| Build script | 1 (CI) | 2 (both impls) | 0.67 |
| Both impls | 0 | Existing deps | — |

New dependencies introduced: build-time flag resolution logic.
Coupling impact: Low within service; adds CI-step coupling.

**Failure Modes**:
| Mode | Severity | Occurrence | Detection | RPN |
|------|----------|------------|-----------|-----|
| Flag checked in accidentally | High | Medium | Low (no test) | 6 |
| Impls drift silently | Medium | High | Low | 6 |
| CI forgets to remove flag | High | Low | High (test fails) | 4 |

**Evolvability Assessment**:
- New handler added: Hard — must create two parallel files per handler
- Workshop exercises evolve: Medium — both stubs and impls need updating
- Additional broken scenarios added: Hard — scattered across many stub files

**Effort Estimate**: S

---

### Option B: Git Branch Strategy (`workshop` branch)

**Summary**: Maintain a `main` (working) branch and a `workshop` branch that contains the intentionally broken state. CI runs on `main`; participants clone the `workshop` branch.

**Architecture**:
```
main   --> working, instrumented, CI green
  |
  └─ workshop  --> broken stub handlers, no dd-trace, CI skipped or expected to fail
```

Workshop branch diverges at the adapter layer only; core domain logic stays in sync via cherry-picks or rebases.

**Pros**:
- Clean separation: participants see exactly the broken code, nothing else
- CI on `main` is entirely unaffected
- No build-time flags or duplicated files in a single branch
- Branch name communicates intent clearly to contributors

**Cons**:
- Two long-lived diverging branches — merge conflicts accumulate over time, especially in shared config files (package.json, tsconfig, Terraform)
- Contributors must remember to keep both branches in sync; easy to forget
- Documentation and workshop guides must reference the correct branch
- Cannot easily show participants the "answer" without switching branches or referencing PRs

**Coupling Analysis**:
| Component | Afferent (Ca) | Efferent (Ce) | Instability |
|-----------|--------------|--------------|-------------|
| `main` adapters | CI pipeline | Core domain | 0.5 |
| `workshop` adapters | Participants | Core domain | 0.5 |
| Core domain (`pricingService`, handlers) | Both branches | EventBridge SDK | low |

New dependencies introduced: branch maintenance discipline.
Coupling impact: Low at code level; High at process/workflow level.

**Failure Modes**:
| Mode | Severity | Occurrence | Detection | RPN |
|------|----------|------------|-----------|-----|
| `workshop` branch drifts behind `main` | High | High | Medium | 8 |
| Merge conflict in shared config | Medium | High | High (CI fails) | 6 |
| Participant clones wrong branch | High | Medium | Low | 6 |
| CI accidentally runs on `workshop` | Medium | Low | High | 2 |

**Evolvability Assessment**:
- New features added to `main`: Medium — must be ported/synced to `workshop`
- Datadog instrumentation updated: Hard — two codebases to update
- Multiple workshop variations: Hard — exponential branch proliferation

**Effort Estimate**: S (initial); M (ongoing)

---

### Option C: Source-Controlled Workshop Overlay via Build Variant

**Summary**: A single branch contains both the working implementation and the workshop stub. The stub lives in a dedicated `workshop/` directory. The build script selects which source to bundle based on an environment variable (`WORKSHOP_BUILD=true`). CI never sets this variable. A README and a `make workshop-build` target make it obvious for participants. A git tag (`workshop-start`) marks the canonical broken state.

**Architecture**:
```
src/pricing-api/adapters/
  calculatePricingFunction.ts         <-- working implementation (CI default)
  productCreatedPricingHandler.ts     <-- working (CI)
  productUpdatedPricingHandler.ts     <-- working (CI)

src/pricing-api/workshop/
  calculatePricingFunction.ts         <-- broken stub (workshop start)
  productCreatedPricingHandler.ts     <-- uninstrumented stub
  productUpdatedPricingHandler.ts     <-- uninstrumented stub

build scripts / package.sh:
  if WORKSHOP_BUILD=true → bundle from workshop/ dir
  else                    → bundle from adapters/ dir (default)

Makefile:
  workshop-build: WORKSHOP_BUILD=true ./package.sh
  build: ./package.sh  (CI uses this)
```

The `workshop-start` git tag points to a commit where the working adapters are temporarily replaced, giving participants a clean starting point without a permanent branch divergence.

**Pros**:
- Single branch, single repo — no long-lived divergence
- CI always builds the working path (default, no env var needed)
- Workshop participants run `make workshop-build` or are guided to the `workshop/` directory
- Working implementations serve as the reference answer, co-located with the stubs
- New handlers require one stub + one impl in their respective locations — no extra branching
- The `workshop/` directory is self-documenting: participants see exactly what needs fixing

**Cons**:
- `workshop/` stubs must be kept in sync with the interface contracts of the working impls
- Slightly more directory structure to explain
- Build script change requires care not to accidentally bundle wrong path

**Coupling Analysis**:
| Component | Afferent (Ca) | Efferent (Ce) | Instability |
|-----------|--------------|--------------|-------------|
| `adapters/` (working) | CI build script | Core domain | 0.5 |
| `workshop/` (stubs) | workshop build | Core domain interfaces | 0.5 |
| Build script | CI + participants | Both adapter sets | 0.67 |
| Core domain | Both | AWS SDK | low |

New dependencies introduced: `WORKSHOP_BUILD` env var in build script.
Coupling impact: Low — only the build layer changes; domain logic untouched.

**Failure Modes**:
| Mode | Severity | Occurrence | Detection | RPN |
|------|----------|------------|-----------|-----|
| Workshop stubs drift from interface | Medium | Medium | Medium (TS compile) | 4 |
| CI accidentally sets WORKSHOP_BUILD | High | Low | High (integration test fails) | 2 |
| Participant forgets to run workshop-build | Medium | Medium | High (immediately obvious) | 4 |
| New handler added without workshop stub | Medium | Medium | Low (manual review) | 4 |

**Evolvability Assessment**:
- New handlers: Easy — add stub to `workshop/`, impl to `adapters/`
- Datadog SDK version bump: Easy — update once in `adapters/`; stubs are intentionally missing it
- Multiple workshop tracks (e.g., different bug types): Medium — parameterise `WORKSHOP_BUILD` to select a subdirectory
- Workshop instructions updated: Easy — single repo, single branch

**Effort Estimate**: M

---

## Comparison Matrix

| Criterion | Option A (Flag File) | Option B (Branch Strategy) | Option C (Build Variant) |
|-----------|---------------------|--------------------------|--------------------------|
| Complexity | Low | Low (initial), High (ongoing) | Medium |
| Single source of truth | No (2 files per handler) | No (2 branches) | Yes |
| CI safety | Medium (flag must be absent) | High (separate branch) | High (env var default is CI) |
| Workshop UX | Poor (unclear) | Good (clean clone) | Good (clear `workshop/` dir) |
| Maintenance burden | High | High | Low-Medium |
| Evolvability | Low | Low | High |
| Failure blast radius | Low | Medium | Low |
| Time to implement | S | S | M |

---

## Recommendation

**Recommended Option**: Option C — Build Variant with `workshop/` overlay directory

**Rationale**:
Option C achieves the core goal (CI green, workshop broken) without the long-lived divergence cost of Option B or the invisible-flag risk of Option A. The working implementations are co-located as the reference answer, which is valuable for both contributors and self-directed workshop participants. The default build path (no env var) is always the safe, CI-green path. The `workshop/` directory is self-documenting.

**Tradeoffs Accepted**:
- Slightly more complex build script: acceptable because the complexity is isolated to one file and covered by CI
- Two implementations per handler: acceptable because the `workshop/` stubs are intentionally thin (no business logic) and won't diverge meaningfully beyond their TypeScript interface signatures

**Risks to Monitor**:
- Interface drift between `workshop/` stubs and `adapters/` working impls: mitigate by ensuring stubs compile against the same shared type definitions
- Contributor discipline: add a CONTRIBUTING note that new adapters require a corresponding workshop stub

---

## Implementation Plan

### Phase 1: Create workshop directory and stubs
- [ ] Create `src/pricing-api/workshop/` directory
- [ ] Copy `calculatePricingFunction.ts` stub (already exists as the current broken version) into `workshop/`
- [ ] Create uninstrumented stub versions of `productCreatedPricingHandler.ts` and `productUpdatedPricingHandler.ts` in `workshop/`
- [ ] Ensure workshop stubs compile (no dd-trace imports, minimal logic)

### Phase 2: Update build scripts
- [ ] Update `package.sh` to check `WORKSHOP_BUILD` env var and switch entry point source directory
- [ ] Update each `build*.js` esbuild script to accept the override entry point (or create parallel `build*.workshop.js` scripts driven by `package.sh`)
- [ ] Add `workshop-build` target to `Makefile`

### Phase 3: CI validation
- [ ] Confirm CI workflow does NOT set `WORKSHOP_BUILD` (it currently doesn't — no change needed)
- [ ] Add a CI step that runs `make workshop-build` to verify the workshop stubs compile
- [ ] Confirm integration tests still pass with default build

### Phase 4: Documentation
- [ ] Add a `WORKSHOP.md` (or section in README) explaining: `git clone`, then `make workshop-build` to build the broken starting state
- [ ] Note the `adapters/` directory as the reference answer

---

## Open Questions
- [ ] Should the workshop stubs be TypeScript or pre-compiled JS? (TypeScript preferred — consistent with existing codebase and catches interface drift at compile time)
- [ ] Should there be a `git tag workshop-start` on the repo? This is complementary and low-cost — can be added.
- [ ] Is there a need for multiple workshop "levels" (e.g., partially instrumented)? If so, parameterise `WORKSHOP_BUILD=level1|level2` to select subdirectory.
