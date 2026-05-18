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

Apply the migration in staging first:

```bash
supabase db push --include-all
# or paste/apply supabase/migrations/202605170001_gestify_security_hardening_foundation.sql in the Supabase SQL editor for staging.
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
FISCAL_SYNC_SECRET=
GESTIFY_NEW_SIGNUPS_ENABLED=false
GESTIFY_SECURITY_HARDENING_CONFIRMED=false
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
