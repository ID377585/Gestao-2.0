# Gestify Security Hardening Runbook

This runbook tracks the production hardening items required before Gestify is treated as a safe multi-tenant SaaS.

## Current production freeze

Keep new customer signups disabled in Vercel Production:

```env
GESTIFY_NEW_SIGNUPS_ENABLED=false
GESTIFY_SECURITY_HARDENING_CONFIRMED=false
```

Only set `GESTIFY_SECURITY_HARDENING_CONFIRMED=true` after the checklist below is complete in staging and production.

## 1. Supabase database hardening

Apply the migrations in staging first:

```bash
supabase db push --include-all
# or paste/apply supabase/migrations/202605170001_gestify_security_hardening_foundation.sql in the Supabase SQL editor for staging.
# include supabase/migrations/20260730120000_security_hardening_phase_one.sql for radio RLS, anon grant removal, RH indexes and backup quarantine.
# include the 20260730124xxx-20260730131xxx phase-two migrations for
# operational anon grant removal, RLS initPlan cleanup, core policy consolidation,
# profile policy consolidation and public helper execute revocation.
# include 20260730132000_harden_order_rls_helpers_phase_two.sql for low-risk
# order helper hardening without replacing live order policies.
```

Validate staging:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'order_status_transitions',
    'stock_balances',
    'inventory_sessions',
    'inventory_items',
    'production_productivity',
    'order_items_labels',
    'stock_transfers',
    'stock_transfer_items',
    'stock_balance_audit',
    'carriers',
    'suppliers',
    'user_module_permissions'
  )
order by tablename;
```

Run Supabase Security Advisors again after staging validation.

Phase one production hardening already targets:

- `music_radio_stations` RLS enabled and forced;
- no `anon` SQL grants for dashboard/business tables;
- service-only notification check RPCs;
- FK/index hardening for RH/player tables;
- `products_cost_backup_20260527` removed from public API roles.

Central policy consolidation is still intentionally staged work. Do not remove all legacy policies in one deploy without validating every module flow.

Phase two additionally targets:

- no `anon` grants on operational checklist, loss, order item, timeline, nutrition and technical-sheet tables;
- legacy `PUBLIC` policies moved to `authenticated`;
- direct `auth.uid()`/`auth.role()` calls in policies converted to `(select ...)`;
- consolidated policies for `products`, `stock_movements`, `customers`, inventory counts/items, labels, losses, billing drafts and `profiles`;
- `public.is_establishment_member(uuid)` no longer executable by API roles.
- `public.is_staff()` and `public.my_role_in_establishment(uuid)` marked `STABLE` and updated to avoid direct per-row `auth.uid()` evaluation;
- `public.order_belongs_to_user(uuid, uuid)` hardened so authenticated callers cannot probe another user's order ownership;
- sensitive API write/upload/cron routes covered by the in-process rate limiter;
- stock-count reminder cron protected by `ALERTS_CRON_SECRET` or `CRON_SECRET`.
- `api_idempotency_keys` table added for retry-safe sensitive operations;
- initial idempotency coverage: order creation, stock movements, inventory label creation, product quick-create, PDF import job creation and loss registration;
- `app_job_queue` table and `/api/jobs/process` worker added for durable background work;
- API CORS restricted to same-origin plus `GESTIFY_ALLOWED_CORS_ORIGINS`;
- private short-lived cache headers added to selected tenant-scoped read APIs.

Remaining policy consolidation should focus on `orders`, `order_status_events`, fiscal tables, transfer/order-label tables and legacy purchase/financial tables in smaller module-specific migrations. A direct live replacement of `orders` and `order_status_events` policies was intentionally avoided because it can affect active order flows; do this in staging or during a controlled deploy window.

## 2. RPC hardening

The migration revokes direct API execution from all `SECURITY DEFINER` routines for `anon`, `authenticated` and `public`.

After applying it, move business actions that need elevated privileges behind server-side routes/actions that:

1. call `supabase.auth.getUser()`;
2. validate membership for the requested `establishment_id`;
3. validate module permissions;
4. write audit logs;
5. call privileged database functions only with server-side credentials when truly needed.

## 3. Storage hardening

The migration sets these buckets private and removes broad public listing policies:

- `invoice-entry-files`
- `technical-sheet-images`

Use signed URLs for reads and server-side upload validation for writes.

## 4. Auth hardening in Supabase Dashboard

Configure manually in Supabase Dashboard:

- Enable leaked-password protection.
- Require confirmed email for new accounts.
- Require MFA for admin users operationally.
- Restrict redirect URLs to production and approved preview domains only.
- Rotate public/service keys if any secrets or temp files were exposed.

## 5. GitHub hardening

Enable branch protection for `main`:

- require pull request before merge;
- require CI status check;
- require conversation resolution;
- block force pushes;
- enable secret scanning and Dependabot alerts;
- require at least one review for production changes.

## 6. Vercel hardening

Production should use only production Supabase credentials.
Preview should use staging/preview credentials.

Required production variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
ALERTS_FROM_EMAIL=
ALERTS_CRON_SECRET=
FISCAL_SYNC_SECRET=
CRON_SECRET=
JOB_WORKER_SECRET=
GESTIFY_ALLOWED_CORS_ORIGINS=
GESTIFY_ALERT_EMAIL_QUEUE_ENABLED=false
NEXT_PUBLIC_APP_URL=
GESTIFY_NEW_SIGNUPS_ENABLED=false
GESTIFY_SECURITY_HARDENING_CONFIRMED=false
```

If `GESTIFY_ALERT_EMAIL_QUEUE_ENABLED=true`, configure a Vercel Cron or protected
worker call to:

```text
POST /api/jobs/process
Authorization: Bearer $JOB_WORKER_SECRET
```

Validate domains:

- `gestify.app`
- `www.gestify.app`

Remove obsolete aliases when safe.

## 7. Release criteria

Do not unfreeze signups until all are true:

- Supabase Advisors no longer show RLS disabled in public tables.
- No broad public storage listing policies remain for sensitive buckets.
- No anon-callable privileged RPCs remain unless intentionally public and audited.
- `npm run ci` passes.
- `npm audit --omit=dev --audit-level=high` passes or every exception is documented and accepted.
- Production and preview variables are separated.
- A restore from backup has been tested.

## 8. Biometric governance

Face-based point identification is sensitive personal data. Keep it treated as an internal operational control until legal and privacy review is complete.

Before broad activation, document:

- purpose and legal basis;
- non-biometric alternative;
- retention and deletion policy;
- access restrictions;
- incident response;
- audit of profile reads/updates;
- process for false positive disputes.
