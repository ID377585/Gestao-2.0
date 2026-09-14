# Gestify — Subprocessor and International Transfer Register

Status: implementing
Owner: Privacy + Security + Procurement
Last review: 2026-09-09

This register must be updated before a new vendor processes production personal data. Unknown values are release blockers for the related integration.

## Mandatory fields per vendor

| Field | Required |
| --- | --- |
| Legal name | yes |
| Product/service | yes |
| Contract owner | yes |
| Processing role | controller / operator / suboperator |
| Purpose | specific |
| Data categories | specific |
| Sensitive data | yes/no + categories |
| Subject categories | specific |
| Production access | none / logical / privileged |
| Hosting/processing countries | specific |
| International transfer | yes/no |
| Transfer mechanism | specific |
| Contract/DPA date | yes |
| ANPD standard clauses incorporated where required | yes/no/n.a. |
| Security review date | yes |
| Retention/deletion commitment | yes |
| Incident notification obligation | yes |
| Downstream subprocessors | list/link |
| Material-change notification | yes/no |
| Exit/export/deletion procedure | yes |
| Next review | date |

## Current core infrastructure — verification required before publication

The following are known technical providers in the current architecture and must have their actual contracts, regions and transfer mechanisms verified against the administrative account before this register is marked validated:

- Supabase — database/auth/storage related infrastructure;
- Vercel — application hosting/deployment/runtime;
- GitHub — source code/CI evidence; production personal data must not be intentionally stored in source or issue content;
- e-mail/communications provider(s) configured in the environment;
- payment/fiscal providers when enabled;
- analytics/observability providers when enabled;
- support/CRM/marketing providers when enabled.

Do not infer a vendor's processing country from its headquarters. Evidence must come from the active service configuration, DPA/subprocessor list and contract.

## International-transfer rule

For every transfer of personal data from Brazil to another country or international organization, document both:
1. the LGPD legal basis for the underlying processing; and
2. the valid transfer mechanism under LGPD/ANPD regulation.

When relying on ANPD standard contractual clauses, use the official text as required by the regulation and do not alter provisions that must be adopted integrally. The contract package must record exporter's/importer's identification, transfer description and the required completed fields.

## Transparency

Where required, public-facing transparency must state in Portuguese, clearly and accessibly:
- transfer form, duration and specific purpose;
- destination country or countries;
- controller identity/contact;
- shared use and purpose;
- responsibilities and security safeguards;
- subject rights and accessible channel.

## Onboarding gate

A vendor that will process production personal data cannot be enabled until:
- Security review: PASS;
- Privacy role/purpose review: PASS;
- DPA/confidentiality: executed where applicable;
- transfer mechanism: documented where applicable;
- retention/deletion: documented;
- incident notification: contractually adequate;
- least-privilege access: configured;
- exit plan: documented.

## Offboarding

On termination:
1. disable access/API keys;
2. export what must be retained;
3. request deletion/return under contract;
4. verify deletion evidence where available;
5. remove integrations and secrets;
6. update public/internal subprocessor lists;
7. preserve only contract/audit evidence required for legal defense/compliance.
