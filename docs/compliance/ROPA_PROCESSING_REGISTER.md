# Gestify — Record of Processing Activities (ROPA)

Status: implementing
Owner: Privacy / Encarregado
Last review: 2026-09-09

This is the minimum register required for accountability. Each production processing activity must be listed before it is considered compliant.

## Required fields

| Field | Description |
| --- | --- |
| Activity ID | stable identifier |
| Module/process | product or business process |
| Owner | accountable business/technical owner |
| Gestify role | Controller / Operator / both by sub-purpose |
| Customer role | Controller / Operator / n.a. |
| Subjects | users, employees, leads, suppliers, consumers, etc. |
| Data categories | exact categories |
| Sensitive data | exact categories or none |
| Source | subject, customer, integration, generated logs, etc. |
| Purpose | specific and limited |
| Legal basis | per purpose |
| Legitimate-interest assessment | reference if used |
| Consent evidence | reference if used |
| Recipients/subprocessors | specific classes/vendors |
| Countries | processing/transfer destinations |
| Transfer mechanism | if applicable |
| Retention rule | reference to schedule |
| Security controls | auth/RLS/encryption/logging/etc. |
| DSAR path | how rights are fulfilled |
| Automated decision | yes/no + review path |
| Children/adolescents | yes/no |
| DPIA/RIPD | reference or rationale n.a. |
| Last review | date |
| Next review | date |

## Initial activity map

The entries below are a starting map and must be validated against actual production code/configuration and customer contracts.

### ROPA-001 — Account creation, authentication and authorization

- Gestify role: Controller for Gestify account/security processing; Operator may apply for customer-managed workforce identity context depending on contract.
- Subjects: customer representatives and authorized users.
- Data: name, email, account identifiers, tenant memberships, roles, session/authentication metadata, security events.
- Purpose: create/manage account, authenticate, authorize, prevent abuse, audit security.
- Bases: contract/pre-contract, legitimate interest for proportionate security where applicable, legal obligations/exercise of rights where applicable.
- Sensitive data: none intended.
- Retention: account/security schedule.
- Controls: Supabase Auth, tenant membership, server authorization, RLS, session controls, audit/security logs.

### ROPA-002 — Customer operational data

- Gestify role: generally Operator.
- Customer: generally Controller.
- Subjects: customer's employees, suppliers, customers and other people whose data the customer lawfully enters.
- Data: depends on enabled modules.
- Purpose: provide contracted management functionality according to documented customer instructions.
- Bases: determined primarily by customer Controller for its data; Gestify processes under contract/instructions and applicable operator duties.
- Sensitive data: prohibited unless an approved feature/use case explicitly supports it.
- Retention: customer term + termination/export/deletion lifecycle + lawful exceptions.

### ROPA-003 — Support and customer success

- Gestify role: Controller for relationship records; Operator if support necessarily accesses customer-controlled content.
- Subjects: customer contacts/users and people appearing in support evidence.
- Data: contact info, ticket content, diagnostic metadata, attachments where provided.
- Purpose: support, diagnosis, quality, security, contractual evidence.
- Controls: minimum necessary access; do not request full production dumps when smaller evidence suffices.

### ROPA-004 — Billing, commercial and fiscal relationship

- Gestify role: Controller.
- Subjects: customer representatives, billing contacts, payers where natural persons are involved.
- Data: contact, subscription, transaction/billing/fiscal information.
- Purpose: contract administration, billing, tax/accounting, collections and legal defense.
- Retention: statutory/accounting + defense-of-rights rule.

### ROPA-005 — Security, fraud prevention and observability

- Gestify role: Controller for platform security; may process customer-controlled identifiers incidentally as Operator.
- Subjects: users and potentially other subjects appearing in events.
- Data: IP, timestamps, request/security metadata, user/account/tenant identifiers, errors; payload logging must be minimized.
- Purpose: detect abuse/incidents, secure platform, troubleshoot, evidence.
- Rule: sensitive/business payloads must not be logged merely for convenience.

### ROPA-006 — Terms/DPA/privacy acceptance evidence

- Gestify role: Controller.
- Subjects: authorized representatives/users accepting documents.
- Data: identity/account/tenant, document/version, timestamp and evidentiary metadata.
- Purpose: contract formation, transparency, accountability, exercise/defense of rights.
- Rule: append-only history; version changes create new records.

### ROPA-007 — Marketing/leads

- Gestify role: Controller.
- Subjects: prospects and customer contacts.
- Data: contact/company, interaction/source/preferences.
- Purpose: requested contact, commercial relationship, lawful marketing.
- Rule: identify legal basis per channel/campaign; practical opt-out; no sensitive targeting.

### ROPA-008 — Incident and privacy-rights handling

- Gestify role: Controller for case administration; Operator assistance may occur for customer-controlled requests/incidents.
- Subjects: requesters, affected users/subjects and authorized representatives.
- Data: identity verification evidence, scope, incident/request facts, decisions/actions.
- Purpose: fulfill legal/contractual duties and preserve accountability.
- Rule: collect only evidence needed for the case; apply restricted access and case retention.

### ROPA-009 — Biometrics/time identification (only if/when enabled)

- Gestify role: depends on actual product/customer instructions; likely Operator for customer workforce use plus Controller for limited platform-security aspects if any.
- Subjects: customer employees/authorized users.
- Data: biometric template/representation and enrollment metadata; source images only if specifically justified.
- Purpose: must be separately approved and narrowly defined.
- Release condition: dedicated RIPD/DPIA, legal basis, customer DPA/instructions, alternative/fallback analysis, lifecycle deletion and enhanced security.
- Current rule: do not treat general platform terms as sufficient authorization for broad biometric processing.

## Update rule

Any PR that adds a personal-data field, new external recipient, new purpose, sensitive-data support, material profiling/automation or new international transfer must update this ROPA or document why no new activity/change exists.