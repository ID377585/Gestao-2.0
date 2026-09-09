# Gestify — Retention, Deletion and Legal Hold Standard

Status: implementing
Owner: Privacy + Legal + Security + Data Owners
Last review: 2026-09-09

## Rule

No category of personal data may be retained indefinitely merely because storage is available. Each category must have: purpose, legal basis, event that starts retention, period/rule, system owner, deletion/anonymization method, backup behavior and documented exceptions.

## Operational schedule baseline

This baseline is intentionally conservative and must be reconciled with tax/accounting, labor, consumer, civil limitation, fraud/security and sector-specific obligations before publication as a contractual promise.

| Category | Operational rule | Start event | End action |
| --- | --- | --- | --- |
| Active user account/profile | while account/service relationship is active | account creation | deactivate and move to termination workflow |
| Authentication/session security events | minimum needed for security, fraud investigation and applicable legal record duties | event timestamp | delete/anonymize after approved security retention window |
| Application access records subject to Marco Civil duties | retain for at least the legally required period when Gestify qualifies as application provider and the statutory condition applies | access event | controlled deletion after legal period unless valid legal hold |
| Terms/DPA/privacy acceptance evidence | while needed to prove contractual/legal relationship and defend rights | acceptance/version event | delete only after legal/contractual defense period and no hold |
| Customer operational data | active term + contractual export/termination window | termination/effective deletion request | export/return, production deletion/anonymization, backup expiry |
| Billing/fiscal/accounting records | statutory/accounting period applicable to the record | transaction/fiscal event | delete/minimize after legal period and no hold |
| Support tickets | service need + dispute/security/legal defense period proportional to ticket content | ticket closure | delete/minimize attachments/content where possible |
| Marketing leads | while a valid legal basis exists; stop consent-based marketing after revocation | collection/last valid interaction | suppress future marketing and delete/minimize when no other basis |
| DSAR cases | enough to evidence identity verification, decision and response without retaining unnecessary request content | case closure | delete/minimize under privacy-case retention rule |
| Security incidents | long enough for investigation, regulatory evidence, remediation and defense of rights | incident closure | archive/minimize according to incident/legal rule |
| Biometric templates, if enabled | only while necessary for approved purpose and legal basis | enrollment | delete promptly after purpose/relationship ends unless lawful hold |
| Source biometric images, if any | avoid by default; if strictly necessary, define shorter explicit window than template | capture | secure deletion |
| Backups | fixed technical rotation; not an alternate archive | backup creation | automatic expiry/overwrite |

## Marco Civil record rule

Before setting the exact production retention for application-access records, Legal and Security must document whether each log qualifies as a 'registro de acesso a aplicações de internet' and which legal duty applies. Where the statutory six-month retention duty applies to an application provider constituted as a legal entity and acting professionally/economically, the system must preserve those records securely for at least that legal minimum while preventing unnecessary enrichment with sensitive content.

Do not transform a legal access log into behavioral surveillance. Store only what is necessary for security/legal evidence.

## Termination workflow

For a normal customer termination:
1. record effective termination time and authorized requester;
2. disable new processing/access except what is needed for export/closure;
3. offer/perform contractually defined export where applicable;
4. identify legal holds and required retained records;
5. delete/anonymize active customer content after the defined export/closure window;
6. ensure deleted content remains unavailable in normal application operations;
7. allow backup copies to expire under the fixed backup cycle;
8. if a backup is restored, re-apply deletion tombstones/actions before restored data returns to normal production use;
9. create non-content evidence that the deletion workflow completed.

## Legal hold

A legal hold suspends normal deletion only for the minimum data/scope needed when there is a documented legal reason, such as litigation, administrative proceeding, investigation, valid authority order or concrete preservation duty.

Every hold must record:
- case/reference;
- legal owner/approver;
- affected person/tenant/data categories;
- legal rationale;
- start date;
- systems/copies covered;
- access restrictions;
- periodic review date;
- release date and deletion instruction.

A vague fear of future litigation is not enough to retain all customer data indefinitely.

## Deletion evidence

Evidence should prove that a process ran without recreating the deleted data. Prefer:
- case ID;
- scope identifiers/hashed references where appropriate;
- counts;
- timestamps;
- systems/actions completed;
- operator/approver;
- exceptions/holds;
- backup expiry date/window.

Do not preserve full deleted payloads merely as proof of deletion.

## Backup restrictions

- backups are not queried for routine business use;
- access is restricted;
- retention is defined by rotation policy;
- restoring an old backup does not cancel valid deletion/rectification obligations;
- exported off-site backups must have encryption, access control, inventory and destruction rules.

## Review

Review this schedule at least annually and whenever a module introduces a new category of personal/sensitive data or a new statutory retention duty.