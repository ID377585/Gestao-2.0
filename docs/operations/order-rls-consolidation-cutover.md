# Order RLS consolidation cutover

## Status

**Prepared and automatically tested; not applied to the connected production project.**

Migration:

```text
supabase/migrations/20260803213227_consolidate_order_rls_p0.sql
```

Automated drill:

```bash
npm run orders:rls:drill
```

The cutover must first run in an isolated Supabase staging project. The repository
drill uses a disposable PostgreSQL instance with Supabase-compatible database
roles and `auth.uid()`/`auth.role()` semantics; it does not use production data
or credentials. Do not apply the migration directly to production.

Latest approved automated evidence:

```text
docs/operations/order-rls-cutover-evidence.md
```

## Why the original draft was revised

The live inventory found more than policy-count noise:

- `orders` had 21 permissive policies;
- `order_status_events` had 19 permissive policies;
- `authenticated` retained broad table privileges, including direct writes and
  operational privileges that are not needed by the application;
- two `AFTER INSERT` triggers could create duplicate initial timeline events;
- an `AFTER UPDATE OF status` trigger duplicated events already written by the
  lifecycle RPCs;
- the prepared role helper read only `memberships`, although the application
  also has `establishment_memberships`;
- the event SELECT rules did not consistently enforce `visible_to_client`;
- cancellation and reopen metadata were not guaranteed to be persisted in the
  same transaction as their status change.

The connected project currently has one order and two events. No existing data
is deleted or rewritten by the cutover.

## Canonical authorization model

### Orders

Authenticated users receive only:

- `SELECT`, filtered by tenant and role;
- column-level `UPDATE` on the temporary server-action compatibility fields:
  `canceled_by`, `canceled_at`, `cancel_reason`, `reopened_by`, `reopened_at`.

There is no direct authenticated `INSERT` or `DELETE` policy. Order creation
continues through the service-role-only `create_order_with_items` server flow.
Order lifecycle status changes continue through approved RPCs.

The canonical row rules are:

- staff roles can read all orders in a tenant where they have active membership;
- clients can read only orders they created or that belong to their customer
  identity;
- only `admin` and `operacao` can perform the limited metadata compatibility
  update;
- identity fields and direct status changes remain guarded by database triggers.

### Timeline

Authenticated users receive `SELECT` only.

- staff can read tenant timeline events;
- clients can read only events for their own orders where
  `visible_to_client = true`;
- no authenticated user can insert, alter or delete timeline rows directly;
- approved SECURITY DEFINER lifecycle functions write exactly one event.

### Membership compatibility

The tenant role helper evaluates active membership from both:

```text
memberships
establishment_memberships
```

It supports `memberships.unit_id` with fallback to `establishment_id` and uses a
deterministic role precedence. An additive partial expression index covers the
actual helper lookup. No historical index is removed by this migration.

## Lifecycle integrity

The migration installs or refreshes the canonical RPC behavior for:

```text
accept_order
advance_order_status
cancel_order
reopen_order
```

The database validates the order tenant, active membership, role, transition,
input length and current status under a row lock.

`cancel_order` now commits these values atomically:

```text
status = cancelado
canceled_by
canceled_at
cancel_reason
timeline event
```

`reopen_order` atomically commits:

```text
status = aceitou_pedido
reopened_by
reopened_at
timeline event
```

The migration removes the duplicate historical triggers and keeps one canonical
initial-order event trigger. Status changes no longer depend on an automatic
`AFTER UPDATE` event trigger; every approved lifecycle function must write its
own explicit event.

## Automated two-tenant drill

Workflow:

```text
.github/workflows/order-rls-cutover.yml
```

The workflow creates a disposable PostgreSQL 17 database and applies:

1. a Supabase-compatible pre-cutover fixture containing duplicate policies,
   broad grants and duplicate timeline triggers;
2. the real cutover migration from the repository;
3. a SQL authorization matrix using actual `authenticated` database sessions.

The drill fails unless it proves all of the following:

- exactly two policies on `orders`: SELECT and controlled UPDATE;
- exactly one SELECT policy on `order_status_events`;
- no direct authenticated order INSERT or DELETE;
- no direct authenticated status update;
- no direct authenticated timeline write;
- no table grants for `anon` or `PUBLIC`;
- only the five compatibility metadata columns are directly updatable;
- exactly one initial event per order;
- no duplicate status event trigger;
- hidden events are invisible to clients;
- Tenant A cannot read or mutate Tenant B;
- a user present only in `establishment_memberships` is authorized correctly;
- client lifecycle and cross-tenant RPC attempts are rejected;
- cancel/reopen metadata and events are persisted by their RPC transaction;
- the extended audit contract reports `gestify-order-rls-v2`.

The workflow publishes only a small JSON report; it never uses production data
or production secrets.

## Staging cutover procedure

1. Create or select a Supabase staging project that contains representative
   admin, operation, production, stock, fiscal, delivery and client users in at
   least two tenants.
2. Record the output of:

   ```bash
   npm run orders:rls:audit
   ```

3. Apply the migration in staging.
4. Run:

   ```bash
   npm run orders:rls:drill
   npm run orders:rls:audit
   npm run supabase:contract
   npm run readiness:strict
   ```

5. Exercise the application smoke matrix:

   - create an order with and without items;
   - accept, advance, cancel and reopen;
   - verify one timeline entry per lifecycle action;
   - confirm client-only event visibility;
   - test two tenants and a multi-tenant user;
   - confirm production, separation, billing and delivery transitions;
   - verify realtime updates and all server-action compatibility writes.

6. Re-run Supabase security and performance advisors.
7. Compare representative query plans with `EXPLAIN (ANALYZE, BUFFERS)`.
8. Promote only in a maintenance window with a verified backup and a tested
   rollback decision.

## Production release gates

Do not promote while any of these remain unresolved:

- credential rotation and incident containment from issue #15;
- absence of a separate staging project;
- failed or missing two-tenant application smoke tests;
- incomplete Vercel server-side secrets;
- failed backup/restore evidence;
- an unexpected increase in RLS audit findings;
- any timeline duplication or cross-tenant visibility.

## Rollback principle

The migration is intentionally data-preserving. A rollback does not require
restoring order rows, but it does require re-establishing the previous policies,
grants and triggers from the pre-cutover schema snapshot.

Do not improvise a rollback by granting `ALL` to `authenticated` or by creating a
`USING (true)` policy. If staging exposes a functional incompatibility, stop the
promotion, preserve the audit output and amend the migration before retrying.
