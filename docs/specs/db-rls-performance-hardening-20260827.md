# DB / RLS / performance hardening — 2026-08-27

Status: validated
Priority: P0/P3

## Context and evidence

Production still differs from the canonical staging/repository contract in two material areas:

1. `public.nutrition_*` has a large residual set of foreign keys without a covering left-prefix index.
2. Production skipped historical migration `20260803213227_consolidate_order_rls_p0`, leaving `orders` and `order_status_events` with many overlapping historical permissive policies instead of the canonical 4 + 2 policy contract used by staging.

The authenticated `SECURITY DEFINER` order/nutrition/stock RPCs were reviewed independently. Their linter warnings are not treated as automatic vulnerabilities: anonymous EXECUTE is already denied and the current contracts validate authenticated identity plus tenant/membership/role or module permission. This change therefore does not revoke intentional application RPCs merely to silence the advisor.

## Problem

### Nutrition FK performance

Missing FK indexes increase the cost of parent updates/deletes and can make joins/dependency checks degrade as Nutrition data grows.

### Order RLS drift

Production's historical policy set executes several permissive policies for the same role/action. This is slower, harder to audit, and no longer matches the canonical tenant-isolation contract already validated in staging.

## Expected behavior

- Every FK on a `public.nutrition_*` table has an equivalent valid index whose leading columns cover the FK columns.
- `public.orders` has exactly the canonical SELECT/INSERT/UPDATE/DELETE RLS contract.
- `public.order_status_events` has exactly the canonical SELECT/INSERT contract.
- Direct status/timeline mutation remains guarded by trigger contracts and official privileged RPC flows.
- Cross-tenant mutations and inactive memberships remain denied.
- No tenant/business rows are modified by either migration.

## Security and tenant invariants

- RLS remains enabled on `orders` and `order_status_events`.
- Canonical helpers derive authorization from `auth.uid()` plus active membership scoped by establishment/unit.
- Client-controlled metadata is not used for authorization.
- Anonymous users receive no EXECUTE on the private authorization helpers.
- Status changes continue to require the official order transition RPC owner context.
- Timeline inserts continue to require the official flow/trigger context.
- Production is read-only during validation; applying these migrations to Production requires explicit human approval.

## Technical design

### Migration 1 — Nutrition FK completeness

`20260827040828_nutrition_fk_index_completeness_phase_two.sql`

Enumerates foreign-key constraints on `public.nutrition_%` tables and creates an index only when no valid equivalent left-prefix index exists. Names are deterministic and include a constraint hash to avoid collisions under PostgreSQL's identifier limit.

### Migration 2 — canonical order RLS reconciliation

`20260827041001_reconcile_production_order_rls_canonical.sql`

Forward-only reconciliation for environments where the historical canonical migration was skipped. It recreates private authorization helpers, trigger guards, and replaces the historical policy set with the canonical policies already used by staging.

## Scope

In scope:
- Nutrition FK index completeness.
- Canonical `orders` / `order_status_events` RLS reconciliation.
- Staging validation and advisor evidence.

Out of scope:
- Removing newly-created indexes because `unused_index` is reported immediately after creation.
- Changing intentional authenticated SECURITY DEFINER application RPCs solely to clear linter warnings.
- Broad consolidation of unrelated HR, inventory, fiscal, notification, invitation, or module-permission policies.
- Production DDL without explicit approval.

## Validation evidence

Staging project: `tuncavkhjazruijujatb`.

- Before Nutrition migration: 108 uncovered Nutrition FKs.
- After Nutrition migration: 0 uncovered Nutrition FKs.
- Supabase Performance Advisor no longer reports Nutrition `unindexed_foreign_keys`; new indexes initially appear as `unused_index` INFO, which is expected before workload accumulates.
- Canonical order RLS reconciliation applied successfully in staging.
- Core transactional E2E passed under mandatory rollback:
  - result: PASS
  - final order status: `entregue`
  - status events: 6
  - final stock: 3
  - invoice total: 20
  - idempotency uniqueness: true
  - order row-lock contract: true
  - cross-tenant transition: denied
  - inactive membership privileged action: denied
- Security Advisor showed no new regression after the changes.

## Acceptance criteria

- [x] Nutrition uncovered FK count is zero in staging.
- [x] Staging keeps exactly the canonical order policy contract.
- [x] Core E2E passes after reconciliation.
- [x] Cross-tenant and inactive-membership negative cases pass.
- [x] Security Advisor has no change-related regression.
- [ ] Repository mandatory CI gates pass on the branch.
- [ ] Human review approves the PR.
- [ ] Separate explicit approval is obtained before Production DDL.

## Production rollout

1. Confirm the production migration history still lacks the historical canonical order-RLS migration and inspect current policies/helpers read-only.
2. Apply the two new forward-only migrations in version order during an approved change window.
3. Re-run Security and Performance Advisors.
4. Verify canonical policy counts/names and Nutrition FK coverage.
5. Run non-destructive authenticated smoke checks for order read/transition behavior.
6. Observe errors/runtime logs after release.

## Rollback

### Nutrition indexes

If a specific new index causes unacceptable write/storage overhead, drop only that index after confirming it is not required for FK/join workload. Do not bulk-remove indexes based solely on `unused_index` INFO.

### Order RLS reconciliation

Preferred rollback is a new forward migration that restores the pre-change Production policies captured immediately before rollout. Do not delete tenant data and do not rewrite migration history. If application behavior regresses, stop rollout, restore the captured policy definitions/trigger state with a forward migration, and re-run the tenant E2E suite.
