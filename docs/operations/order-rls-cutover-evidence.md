# Order RLS cutover automated evidence

Date: 2026-08-10

## Status

The order RLS consolidation passed an isolated two-tenant database drill. The
migration remains **unapplied** to the connected Supabase production project.

```text
Branch: agent/gestify-core-v1
Validated commit: 5a0db2c44360c49187f3496f412ee93c33a47c44
Workflow: Order RLS cutover drill
Run: 31436002223
Run number: 3
Conclusion: success
Artifact: gestify-order-rls-cutover-31436002223-1
Artifact digest: sha256:43acb19104669f8df415d2975392bab6fcfdff0e460a39761141edf7c744d7ac
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

## Approved report

```json
{
  "ok": true,
  "events": 8,
  "format": "gestify-order-rls-cutover-report-v1",
  "orders": 3,
  "auditVersion": "gestify-order-rls-v2",
  "eventPolicies": 1,
  "ordersPolicies": 2,
  "anonymousTableGrants": 0,
  "duplicateEventTriggers": 0,
  "membershipSourcesValidated": [
    "memberships",
    "establishment_memberships"
  ],
  "authenticatedOrderUpdateColumns": [
    "cancel_reason",
    "canceled_at",
    "canceled_by",
    "reopened_at",
    "reopened_by"
  ]
}
```

The matrix also proved:

- direct authenticated order creation and deletion are denied;
- direct status changes are denied;
- direct timeline writes are denied;
- clients only see their own orders and client-visible events;
- Tenant A cannot read or mutate Tenant B;
- a user stored only in `establishment_memberships` is recognized correctly;
- customer lifecycle RPC attempts are rejected;
- cancellation and reopen metadata are committed atomically with status and
  timeline events;
- each inserted order creates exactly one initial timeline event;
- no existing index is removed by the migration.

## Failures caught before approval

The drill failed twice before passing, without touching production:

1. the first implementation tried to store a custom per-function GUC, which is
   not a portable migration mechanism for this purpose;
2. the official PostgreSQL image briefly reported readiness during its temporary
   initialization server and restarted before the test connected.

The migration now identifies trusted lifecycle writes by the effective function
role, and the runner requires three consecutive readiness checks before applying
SQL. These failures are evidence that the workflow is exercising the cutover,
not merely checking static text.

## Limits and remaining gates

This evidence validates the database authorization model in an isolated fixture.
It does not replace application staging. Before production promotion, the team
still needs:

- a separate Supabase staging project with representative data and roles;
- login/session and two-tenant browser smoke tests;
- order creation with items;
- production, separation, billing, fiscal, transport and delivery flows;
- realtime behavior and current server-action compatibility writes;
- Supabase security/performance advisors after staging cutover;
- representative `EXPLAIN (ANALYZE, BUFFERS)` measurements;
- verified backup and rollback decision;
- completion of the credential incident controls in issue #15.
