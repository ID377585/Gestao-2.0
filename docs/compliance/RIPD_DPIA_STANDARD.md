# Gestify — RIPD / DPIA Standard

Status: implementing
Owner: Privacy + Security + Product
Last review: 2026-09-09

## When a RIPD/DPIA is mandatory internally

Even when a formal report is not expressly demanded by ANPD for every treatment, Gestify requires a documented impact assessment before production rollout when any of the following is true:
- biometric identification or authentication;
- health, genetic, sexual-life, political, religious, union or other sensitive data;
- systematic monitoring of employees/individuals;
- large-scale profiling or behavioral analysis;
- solely automated decisions with material effects;
- children/adolescent data;
- new cross-context use of existing personal data;
- large export/share to a new recipient;
- international transfer with material change in country/vendor/mechanism;
- combining datasets that materially increases re-identification or discrimination risk;
- a feature that could expose one tenant's data to another if authorization fails.

## Required content

Every assessment must identify:
1. feature/process owner;
2. purpose and business necessity;
3. controller/operator roles;
4. categories of subjects;
5. data categories, including sensitive data;
6. collection sources;
7. legal basis per purpose;
8. recipients/subprocessors;
9. data flow and international transfers;
10. retention/deletion rules;
11. access/tenant/security controls;
12. likely threats and misuse scenarios;
13. severity and likelihood before controls;
14. mitigations;
15. residual risk;
16. rights/notice mechanisms;
17. alternatives considered, including less intrusive designs;
18. decision and approvers;
19. review date and triggers for reassessment.

## Risk scale

Severity: 1 negligible, 2 limited, 3 significant, 4 serious, 5 critical.
Likelihood: 1 rare, 2 unlikely, 3 possible, 4 likely, 5 very likely.
Risk = severity x likelihood.

- 1-4: low;
- 5-9: moderate;
- 10-14: high;
- 15-25: critical.

High residual risk requires Privacy + Security approval and documented justification before staging promotion. Critical residual risk is a release blocker until materially reduced or expressly accepted by executive leadership after qualified legal review.

## Biometric-specific requirements

Before any broad biometric use:
- document why a less intrusive identifier is insufficient;
- identify biometric representation stored (template/embedding/image) and avoid retaining source images unless necessary;
- prohibit use for marketing/profiling unrelated to authentication/timekeeping purpose;
- define enrollment, revocation/re-enrollment and deletion lifecycle;
- ensure tenant isolation and role-restricted administration;
- provide alternative procedure when legally/operationally necessary;
- test false acceptance/rejection risks and human fallback;
- define incident response specifically for irreversible biometric compromise.

## Children/adolescents

No module may intentionally target or profile children/adolescents without a dedicated assessment covering best interest, applicable parental/guardian requirements, notices, minimization and deletion. If the SaaS is not designed for minors, collection should be contractually and technically discouraged rather than silently accepted.

## Automated decision/AI assessment

Document:
- input features;
- purpose;
- whether the output affects access, employment, pricing, credit, evaluation, discipline or other material interest;
- human override/review;
- explanation capability;
- bias/discrimination testing;
- model/provider data-use terms;
- whether prompts/outputs leave Brazil;
- whether customer data is used to train provider models;
- retention and opt-out controls.

## Reassessment triggers

Repeat the assessment after:
- material scope/purpose change;
- new sensitive field;
- new subprocessor/country;
- material security architecture change;
- confirmed privacy incident;
- material legal/regulatory change;
- evidence that initial risk assumptions were wrong.
