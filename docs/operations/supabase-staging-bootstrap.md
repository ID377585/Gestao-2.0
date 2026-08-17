# Supabase staging bootstrap gate

## Status verified on 10/08/2026

The clean bootstrap gate is green. The workflow `Supabase full migration smoke`
replayed the complete migration history from an empty Supabase stack and passed
schema lint, the functional contract, the Gestify Core security contract and the
order RLS audit.

Evidence:

```text
Commit:     0e8fdc7522d0a3f205bf38617340e00337f34e44
Workflow:   Supabase full migration smoke
Run:        31449071860
Run number: 25
Conclusion: success
Migrations: 117
```

A cloud staging project has **not** been created. No migration is authorized for
the connected production project.

## Intended staging project

```text
Name:   gestify-staging
Region: sa-east-1
```

The Supabase organization currently has no project with that name. Creating a
new project or a paid preview branch can affect billing. Project creation remains
behind an explicit cost confirmation and must not reuse an unrelated project.

## Protected staging workflow

Workflow:

```text
.github/workflows/supabase-staging.yml
```

It is manual-only (`workflow_dispatch`), uses the protected GitHub Environment
`staging`, accepts only `plan`, `verify` or `apply`, and never targets a project
until the staging guard proves that it differs from production.

The workflow is restricted to:

```text
main
agent/gestify-core-v1
```

Configure the GitHub Environment with required reviewers and deployment-branch
rules before storing any staging secret.

### GitHub Environment variables

```text
STAGING_PROJECT_ID
PRODUCTION_PROJECT_ID
STAGING_PROJECT_NAME=gestify-staging
STAGING_EXPECTED_REGION=sa-east-1
```

### GitHub Environment secrets

```text
SUPABASE_ACCESS_TOKEN
STAGING_DB_PASSWORD
STAGING_SUPABASE_URL
STAGING_SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_ACCESS_TOKEN` must be scoped to the account that can access the intended
organization. The staging database password and service-role key must never be
copied from production. Do not place any of these values in repository variables,
Vercel public variables, commits, logs or screenshots.

## Staging target guard

Reusable commands:

```bash
node scripts/supabase/test-validate-staging-target.mjs
bash scripts/supabase/run-staging-contract.sh plan
bash scripts/supabase/run-staging-contract.sh verify
```

The guard checks:

- execution environment is exactly `staging`;
- staging and production project refs are valid and different;
- the staging URL belongs to the staging project ref;
- the access token can see the configured project;
- project name is `gestify-staging`;
- region is `sa-east-1`;
- `apply` has an exact typed confirmation.

The confirmation format is:

```text
apply:gestify-staging:<STAGING_PROJECT_ID>
```

Project inventory is used only during validation and is deleted before artifact
upload, so unrelated project names are not retained in CI evidence.

## Action modes

### `plan`

1. Replays every migration in a clean local Supabase stack.
2. Validates the target project and organization inventory.
3. Links only to the validated staging project.
4. Runs `supabase db push --linked --dry-run`.
5. Does not apply migrations.

### `apply`

1. Requires the exact typed confirmation.
2. Repeats the clean local bootstrap.
3. Runs the remote dry-run.
4. Applies pending migrations only to the validated staging project.
5. Runs migration history, linked database lint, functional/security contracts
   and the order RLS audit.

No seed is applied by this workflow.

### `verify`

Does not apply migrations. It validates the existing staging project, migration
history, database lint and remote Gestify contracts.

## Vercel Preview after project creation

Only after staging exists and the migration contract passes, configure Vercel
Preview with staging-only values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Never place the production service-role key in Preview. Keep new signups disabled
until the two-tenant application smoke is approved.

## Promotion sequence

1. Obtain explicit cost confirmation and choose the Supabase organization.
2. Create `gestify-staging` in `sa-east-1`.
3. Configure the protected GitHub Environment `staging`.
4. Run the staging workflow in `plan` mode and review the artifact.
5. Run `apply` with the exact confirmation.
6. Run `verify` independently.
7. Create two fictitious tenants and isolated users.
8. Validate Auth, sessions, tenant switching, RLS, Realtime and private Storage.
9. Test loss registration with and without labels, including idempotency and
   transaction rollback.
10. Test the full order lifecycle and confirm the legacy fallback no longer runs.
11. Execute security and performance advisors plus targeted
    `EXPLAIN (ANALYZE, BUFFERS)`.
12. Record backup and rollback evidence.
13. Keep production blocked until issue #15 and every release gate are closed.
