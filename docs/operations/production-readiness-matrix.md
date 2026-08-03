# Production Readiness Matrix

This matrix turns the hardening audit into repeatable operating criteria.

## Automated Checks

Run before production promotion:

```bash
npm run readiness:check
npm run lint
npm run typecheck
npm run audit
npm run tenant:writes:ci
npm run supabase:contract
npm run orders:rls:ci
npm run build
```

Use strict mode only when production secrets are available in the execution
environment:

```bash
npm run readiness:strict
```

## P0 Status

| Item | Current handling | Remaining external action |
| --- | --- | --- |
| Order RLS consolidation | Cutover migration prepared and versioned | Apply only in staging first, then production window |
| Tenant isolation tests | Tenant write audit blocks new unscoped writes | Create real two-tenant staging fixtures |
| Leaked password protection | Documented as required | Enable in Supabase Auth dashboard |
| Secrets completeness | `.env.example` and readiness script updated | Configure/rotate in Vercel and Supabase dashboards |
| Invalid refresh tokens | Middleware cleanup already implemented | Monitor runtime logs after deploys |
| Direct order status writes | Cutover trigger prepared | Apply after staging validates legacy order flows |
| SECURITY DEFINER RPCs | Order RLS audit checks definitions and grants | Keep grants reviewed after each DB migration |
| Staging environment | Runbook exists | Create separate Supabase project/branch and Vercel Preview env |
| Branch protection | Documented as required | Enable in GitHub repository settings |

## Cron Matrix

| Route | Method | Schedule | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `/api/jobs/process` | `GET` or `POST` | not scheduled until secrets are confirmed | `JOB_WORKER_SECRET` or `CRON_SECRET` | Process queued alert/email jobs and runtime cleanup |
| `/api/fiscal/sync` | `GET` | `0 5 * * *` | `FISCAL_SYNC_SECRET` or `CRON_SECRET` | Fiscal document sync |
| `/api/notifications/stock-count-reminders` | `GET` or manual | not scheduled yet | `ALERTS_CRON_SECRET` or `CRON_SECRET` | Inventory reminder notifications |
| `/api/alerts/orders/overdue` | `GET` or manual | not scheduled yet | `ALERTS_CRON_SECRET` or `CRON_SECRET` | Overdue order alerts |

After `JOB_WORKER_SECRET` or `CRON_SECRET` is confirmed in Vercel Production,
add this cron if the Vercel plan supports the interval:

```json
{
  "path": "/api/jobs/process",
  "schedule": "*/10 * * * *"
}
```

Keep `GESTIFY_ALERT_EMAIL_QUEUE_ENABLED=false` until the worker runs frequently
enough for the desired SLA. If the plan does not support 10-minute cron, use an
allowed interval or an external scheduler that sends `Authorization: Bearer`.

## RPO and RTO Targets

Initial targets for pilot customers:

- RPO: 15 minutes for database data.
- RTO: 4 hours for app plus database restore.
- Storage restore: same business day for non-critical attachments.

Before broad commercialization, validate real restore timing and replace these
targets with measured values.

## Biometric Governance Gate

Face-based clock-in remains internal-control only until all items are complete:

- documented purpose and legal basis;
- non-biometric alternative;
- private bucket and short signed URLs;
- retention and deletion policy;
- consent/notice flow when required;
- admin-only access with audit trail;
- false-positive dispute workflow;
- incident response plan.

## Release Gate

Do not set `GESTIFY_NEW_SIGNUPS_ENABLED=true` or
`GESTIFY_SECURITY_HARDENING_CONFIRMED=true` until:

1. staging uses a separate Supabase project/branch;
2. order RLS cutover passes on staging;
3. backup restore has been tested;
4. Vercel production variables pass `npm run readiness:strict`;
5. branch protection is enabled on `main`;
6. smoke tests pass for admin, staff and customer roles.

## Dependency Exceptions

Current accepted exception after conservative `npm audit fix`:

- `uuid <11.1.1` via `exceljs`.

Reason: npm only offers `npm audit fix --force`, which would install an older
breaking `exceljs` version. Keep this exception monitored and remove it when
`exceljs` releases a non-breaking fix or when exports can be validated after a
controlled dependency change.
