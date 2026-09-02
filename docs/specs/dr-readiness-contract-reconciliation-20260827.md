# DR and readiness contract reconciliation — 2026-08-27

Status: validated
Priority: P2

## Context and evidence

The safe DR preflight is already on `main`, but running
`scripts/audit-disaster-recovery.mjs` against the current repository fails. The
repository does not yet ignore every generated backup artifact, document the DR
environment contract, or expose an aggregate package script that CI can enforce.
The readiness checker also requires `NUTRITION_CRON_SECRET`, while
`.env.example` does not document it.

## Problem

A passing fixture/preflight workflow is not sufficient if the repository can
accidentally track backup bundles or if required operational variables are not
documented. Because the full DR auditor is not part of CI, these gaps can recur
without blocking a pull request.

## Expected behavior

- local DR output directories and encrypted bundle/checksum/metadata files are
  ignored by Git;
- all DR variables used by the protected workflow are documented as empty
  placeholders, explicitly outside Vercel;
- `NUTRITION_CRON_SECRET` is included in the environment contract;
- one aggregate `core:security:audit` command validates the original DR
  contract and the synthetic operational preflight;
- CI runs the aggregate audit on every pull request and push to `main`.

## Security invariants

- no credential value is added to source control;
- Production backup remains disabled by default;
- this change does not execute a backup, restore, query or deployment;
- Production and Santino traffic are not touched;
- encrypted backups are never uploaded as GitHub artifacts or committed.

## Scope

In scope: `.gitignore`, `.env.example`, `package.json`, CI wiring and this spec.

Out of scope: configuring secrets/runners/buckets, enabling the live DR job,
reading Production, running the first real backup, restoring DB/Storage, or
measuring RPO/RTO.

## Validation

1. Run `npm run core:security:audit`.
2. Run `npm run readiness:check` and confirm the missing
   `NUTRITION_CRON_SECRET` documentation failure disappears.
3. Run the normal static CI gates and `git diff --check`.
4. Confirm no secret-shaped value was introduced.

## Rollout

Ship as an isolated pull request. The change affects only repository contracts
and CI. Keep `GESTIFY_DR_ENABLED=false`; operational execution remains a later,
human-approved step.

## Rollback

Revert the isolated commit. No database, Storage, Vercel or tenant-data rollback
is required.
