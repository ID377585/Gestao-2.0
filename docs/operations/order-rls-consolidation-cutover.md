# Order RLS Consolidation Cutover

Status: prepared, not applied automatically.

This runbook covers the P0 hardening for `public.orders` and
`public.order_status_events`. It is intentionally separated from regular app
deploy work because it changes RLS behavior on live order flows.

## Current Risk

The production database currently has many permissive policies on the same
tables and commands:

- `orders`: multiple `SELECT`, `INSERT`, and `UPDATE` policies.
- `order_status_events`: multiple `SELECT` and `INSERT` policies.

Permissive RLS policies are combined with `OR`, so one old broad policy can
authorize access that a newer stricter policy intended to block.

## Target Matrix

`orders`:

- `SELECT`: authenticated active member in the order establishment.
- `INSERT`: authenticated active member in the order establishment, with
  `created_by = auth.uid()`.
- `UPDATE`: staff in the order establishment, or customer updating only their
  own draft order.
- `DELETE`: admin only.
- `status`: cannot be changed directly by table update; must go through an
  order status RPC.

`order_status_events`:

- `SELECT`: same order visibility rules as the parent order.
- `INSERT`: only internal order status flows.
- `UPDATE`: no direct user policy.
- `DELETE`: no direct user policy.

## Production Safety Requirements

Before applying the prepared migration:

1. Create or use a staging Supabase branch/project.
2. Apply the migration on staging.
3. Validate with at least two establishments and different users:
   - admin;
   - operacao;
   - producao;
   - estoque;
   - fiscal;
   - entrega;
   - cliente.
4. Exercise these flows end to end:
   - create order;
   - add item;
   - accept order;
   - advance order status;
   - production finish;
   - separation finish;
   - billing/shipping status;
   - cancellation;
   - reopen.
5. Run:
   - `npm run supabase:contract`
   - `npm run orders:rls:ci`
   - `npm run tenant:writes:ci`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
6. Schedule a low-traffic production window.
7. Monitor Vercel runtime errors and Supabase logs immediately after the
   migration.

## Prepared Migration

The cutover SQL is versioned at:

`supabase/migrations/20260803213227_consolidate_order_rls_p0.sql`

It creates private helper functions, status/timeline guard triggers, marks the
known order status RPC flows as internal, drops historical duplicate policies,
and recreates a compact canonical policy set.

## Rollback Approach

If production behavior regresses after the cutover:

1. Stop new manual testing on orders.
2. Restore the previous policies from the Supabase migration history or a
   staging clone.
3. Disable the new guard triggers:

```sql
drop trigger if exists gestify_require_order_status_flow on public.orders;
drop trigger if exists gestify_require_order_event_flow on public.order_status_events;
```

4. Re-run the smoke test above.

The migration does not alter or delete order data.
