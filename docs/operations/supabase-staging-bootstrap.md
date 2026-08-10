# Supabase staging bootstrap gate

## Status

Staging is not created and no migration is authorized for the connected
production project.

Before provisioning a paid or third active Supabase project, the repository must
prove that its complete migration history can bootstrap a clean Supabase
instance. The `Order RLS cutover drill` validates the order-security migration
against a focused fixture; it does not prove that every historical migration can
build the entire Gestify schema from zero.

## Disposable full-migration smoke

Workflow:

```text
.github/workflows/supabase-migration-smoke.yml
```

Local command after installing Docker and the Supabase CLI:

```bash
bash scripts/supabase/run-full-migration-smoke.sh
```

The workflow pins the Supabase CLI, starts an isolated local Supabase stack with
PostgreSQL 17, applies every SQL file under `supabase/migrations`, and then runs:

```text
supabase db lint --local --level error --fail-on error
npm run supabase:contract
npm run orders:rls:audit
```

It publishes a sanitized artifact under:

```text
.artifacts/supabase-migration-smoke/
```

No cloud project, production credential or production data is used.

## Why this gate is mandatory

The current repository evolved from an existing hosted database. Historical
migrations may contain assumptions about tables, functions, enums or policies
that already existed before version control became complete. Creating staging
before testing a clean bootstrap could produce a half-created environment and
encourage unsafe migration-history repairs.

A failed smoke test means the migration chain needs a reviewed baseline or
compatibility migration. It must not be bypassed by marking migrations as
applied without proving their resulting schema.

## Project provisioning decision

The connected Supabase organization is currently on the Free plan and already
has two active projects. A separate active staging project can therefore affect
billing or require a project/plan decision. Do not reuse an unrelated Tarot
project and do not repurpose the connected production project.

The intended staging project is:

```text
Name:   gestify-staging
Region: sa-east-1
```

Project creation requires explicit cost confirmation. After creation, configure
a protected GitHub Environment named `staging` with separate staging-only
credentials. Never copy production service-role keys into Preview or pull-request
secrets.

## Promotion sequence

1. Full migration smoke passes from a clean local Supabase stack.
2. A separate staging project is created after cost confirmation.
3. Migrations are dry-run against staging.
4. Migrations are applied only to staging.
5. Supabase contracts, advisors and order RLS audit pass.
6. Two-tenant application smoke tests pass.
7. Realtime, Storage, Auth and Server Actions are validated.
8. Backup and rollback evidence is recorded.
9. Production remains blocked until issue #15 and all release gates are closed.
