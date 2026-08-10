# Order RLS cutover automated evidence

Date: 2026-08-10

## Status

The read-only order RLS consolidation passed an isolated two-tenant database
drill. The migration remains **unapplied** to the connected Supabase production
project.

```text
Branch: agent/gestify-core-v1
Validated commit: 9386e1f57db2bd0232717f989e5deee39bb0bc9b
Workflow: Order RLS cutover drill
Run: 31439017695
Run number: 13
Conclusion: success
Artifact: gestify-order-rls-cutover-31439017695-1
Artifact digest: sha256:ce2b9995b9be6784578c51b83ba8ffaef841ed3cd8d77f6c019974d000750fbf
```

## Live inventory that motivated the cutover

The read-only inventory of the connected project found:

```text
orders policies:                 21
order_status_events policies:    19
orders rows:                      1
order_status_events rows:         2
events with tenant mismatch:      0
```

It also found broad `authenticated` table privileges, two competing initial
order-event triggers and an additional status-change event trigger, even though
lifecycle RPCs already write their own timeline events. The application has two
membership sources, `memberships` and `establishment_memberships`; the earlier
cutover draft evaluated only one of them.

No write was performed against the connected project during this inventory.

## Drill design

The workflow starts an official disposable `postgres:17-alpine` database. The
fixture recreates the relevant Supabase database contract without production
services or secrets:

- roles `anon`, `authenticated`, `service_role` and `supabase_admin`;
- `auth.uid()` and `auth.role()` based on request JWT settings;
- the order status enum, transition table and relevant tenant tables;
- intentionally duplicated permissive policies;
- intentionally broad authenticated grants;
- intentionally duplicated initial/status timeline triggers.

The workflow then applies the real repository migration and runs actual SQL
sessions under `SET LOCAL ROLE authenticated` for:

- Tenant A administrator;
- Tenant A operation user present only in `establishment_memberships`;
- Tenant A customer;
- Tenant B customer.

A second workflow step opens the generated report and fails unless the final
surface is strictly read-only for authenticated order-table access.

## Approved report

```json
{
  "ok": true,
  "events": 8,
  "format": "gestify-order-rls-cutover-report-v1",
  "orders": 3,
  "auditVersion": "gestify-order-rls-v3",
  "eventPolicies": 1,
  "ordersPolicies": 1,
  "anonymousTableGrants": 0,
  "duplicateEventTriggers": 0,
  "membershipSourcesValidated": [
    "memberships",
    "establishment_memberships"
  ],
  "authenticatedOrderUpdateColumns": []
}
```

The matrix proved:

- direct authenticated order creation, update and deletion are denied;
- authenticated has no column-level UPDATE privilege on `orders`;
- direct status changes are denied;
- direct timeline writes are denied;
- clients only see their own orders and client-visible events;
- Tenant A cannot read or mutate Tenant B;
- a user stored only in `establishment_memberships` is recognized correctly;
- customer lifecycle RPC attempts are rejected;
- cancellation and reopen metadata are committed atomically with status and
  timeline events;
- direct metadata updates remain denied before and after those RPCs;
- each inserted order creates exactly one initial timeline event;
- no existing index is removed by the migration.

## Application compatibility during the pre-cutover period

The connected production project still exposes older `cancel_order` and
`reopen_order` functions that do not persist every lifecycle metadata field.
Removing the application fallback immediately would therefore break the current
system before staging receives the new migration.

The Server Actions now use a bounded transition strategy:

1. execute the official RPC;
2. read the order back;
3. finish when the v3 RPC persisted the metadata;
4. use the current authenticated server session for the legacy metadata update
   only when the connected old RPC did not.

The fallback does not use `service_role`, does not place a privileged key in the
browser and does not create a new Preview-secret dependency. After v3, the RPC
persists the fields atomically and the fallback is not executed. Even if a code
regression attempts it, the database has no authenticated UPDATE policy or
grant and fails closed.

## Failures caught before approval

The drill and publication flow caught several issues without touching
production:

1. the first implementation tried to store a custom per-function GUC, which is
   not a portable migration mechanism for this purpose;
2. the official PostgreSQL image briefly reported readiness during its temporary
   initialization server and restarted before the test connected;
3. the first least-privilege application bridge would have introduced an
   unnecessary `service_role` dependency in Preview;
4. the deterministic correction initially rejected an expected duplicate source
   pattern and was tightened to require exactly two occurrences before writing.

The migration now identifies trusted lifecycle writes by the effective function
role, the runner requires stable readiness, the compatibility fallback remains
session-scoped, and the report-level gate verifies the effective privileges.
These failures are evidence that the workflow exercises the cutover rather than
checking static text.

## Limits and remaining gates

This evidence validates the database authorization model in an isolated fixture.
It does not replace application staging. Before production promotion, the team
still needs:

- a separate Supabase staging project with representative data and roles;
- login/session and two-tenant browser smoke tests;
- order creation with items;
- production, separation, billing, fiscal, transport and delivery flows;
- cancellation and reopen smoke tests proving no legacy-fallback warning after
  v3;
- realtime behavior and current Server Action validation;
- Supabase security/performance advisors after staging cutover;
- representative `EXPLAIN (ANALYZE, BUFFERS)` measurements;
- verified backup and rollback decision;
- completion of the credential incident controls in issue #15.
