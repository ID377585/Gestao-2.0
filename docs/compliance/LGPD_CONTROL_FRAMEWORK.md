# Gestify — LGPD / Compliance Control Framework

Status: implementing
Owner: NT Solution / Gestify
Last review: 2026-09-09

## Objective

Define an auditable control framework for privacy, personal-data protection, consumer relations and contractual operation of the Gestify SaaS in Brazil. This framework does not replace qualified legal counsel; it establishes the minimum evidence and operational controls that must exist before the company describes a topic as compliant.

## Normative baseline

At minimum, every review must consider the current versions of:

- Lei 13.709/2018 (LGPD);
- Lei 12.965/2014 (Marco Civil da Internet) and applicable regulation;
- Lei 8.078/1990 (Código de Defesa do Consumidor) when there is a consumer relationship;
- Lei 12.414/2011 when positive credit data is processed;
- Lei 12.846/2013 and applicable integrity obligations when relevant to customers/partners;
- Civil Code, electronic contracting/evidence rules, tax/accounting retention obligations and sector-specific obligations applicable to the customer or processing activity;
- ANPD regulations in force, especially incident communication, data protection officer/encarregado and international data transfers.

A regulatory review must be performed at least quarterly and whenever ANPD, courts or legislation materially change the obligations relevant to the product.

## Control domains

### C01 — Governance and accountability

Required evidence:
- named controller/operator roles per processing activity;
- public privacy contact and named encarregado when applicable;
- ROPA (record of processing activities) with owner, purpose, data categories, subjects, legal basis, sharing, retention, security and transfer mechanism;
- documented privacy decisions and exceptions;
- annual management review and quarterly regulatory review;
- training for people with privileged access to personal data.

Failure condition: a treatment exists without an identified owner, purpose, legal basis or retention rule.

### C02 — Data inventory and minimization

Required evidence:
- inventory of personal and sensitive data fields by module;
- prohibition on collecting credentials/secrets in free-text business fields;
- data-classification labels: public, internal, confidential, personal, sensitive;
- collection limited to what is necessary for the documented purpose;
- review before adding new mandatory fields.

Failure condition: a field is collected only because it may be useful in the future.

### C03 — Legal basis and purpose limitation

Required evidence:
- legal basis mapped per activity;
- legitimate-interest assessment when that basis is used;
- consent only when genuinely appropriate, with version, timestamp, affirmative act and revocation path;
- separate rules for sensitive data under LGPD art. 11;
- no silent repurposing of previously collected data.

Failure condition: generic consent is treated as universal authorization.

### C04 — Controller/operator contract

For customer data inserted into Gestify, the DPA must state, without vague delegation:
- documented instructions and permitted purposes;
- confidentiality obligations of authorized personnel;
- minimum security controls;
- subprocessor conditions;
- international transfer mechanism;
- assistance with data-subject rights;
- incident escalation window;
- return/export/deletion at termination;
- audit/evidence rules that do not expose other tenants;
- responsibilities and legally non-waivable liability;
- procedure for unlawful instructions.

Failure condition: the contract says only that the parties will comply with LGPD.

### C05 — Data-subject rights (DSAR)

Required evidence:
- privacy channel publicly available;
- identity/authority verification before disclosure or deletion;
- request ID, date, scope, role (controller/operator), deadlines, actions and response evidence;
- immediate confirmation/access when required and detailed response within the applicable legal timeframe;
- free exercise of rights;
- escalation to customer controller when Gestify is operator;
- legal-hold check before deletion;
- export that excludes data belonging to other tenants/subjects.

Failure condition: request is handled only by informal chat without an audit trail.

### C06 — Sensitive data, biometrics, children and vulnerable people

Required evidence:
- DPIA/RIPD before broad biometric activation or other high-risk sensitive processing;
- documented legal basis and necessity for sensitive data;
- prohibition on using biometrics/sensitive data for behavioral advertising;
- children/adolescents processing disabled by default unless a specific lawful use case, best-interest analysis and required notices/consents are implemented;
- privileged access, purpose limitation and deletion criteria for biometric templates.

Failure condition: sensitive data is enabled by a feature toggle without legal/risk assessment.

### C07 — Automated decisions and AI

Required evidence:
- inventory of decisions based solely on automated processing that can materially affect a person;
- explanation of principal criteria where required and lawful;
- human review path when applicable;
- tests for discriminatory or disproportionate effects;
- no training of external AI systems with customer personal data unless contract, transparency, legal basis, security and transfer controls explicitly permit it.

Failure condition: a model changes access, employment, credit, pricing or similar material treatment with no review/governance.

### C08 — Security and tenant isolation

Required evidence:
- RLS/tenant controls and least privilege;
- secrets kept server-side;
- secure authentication/session management;
- vulnerability/dependency management;
- logging without unnecessary secrets/sensitive data;
- encryption in transit and at-rest protections available in infrastructure;
- incident detection, backup/restore and change control;
- periodic access review for privileged users.

Failure condition: authenticated role alone grants access without ownership/tenant authorization.

### C09 — Incident response and breach notification

Required evidence:
- incident register including non-notified incidents;
- time of detection and time of confirmed personal-data impact;
- containment and evidence preservation;
- assessment of affected data, number/type of subjects, tenants and safeguards;
- controller/operator escalation;
- communication package ready for ANPD and subjects when applicable;
- post-incident corrective actions.

Internal target: operator-to-controller notification as soon as reasonably possible and ordinarily within 24 hours of confirming a material incident affecting that controller, so the controller retains time to meet external legal obligations. This internal target does not change the statutory/regulatory responsibility of the controller.

Failure condition: there is no reliable timestamp from knowledge of personal-data impact.

### C10 — Retention, deletion, backup and legal hold

Required evidence:
- retention schedule by data class and system;
- event that starts each retention period;
- owner and deletion method;
- backup expiration behavior;
- legal-hold mechanism preventing unlawful deletion;
- deletion evidence without preserving the deleted personal content unnecessarily;
- contract termination export/deletion workflow.

Failure condition: 'retain as long as necessary' exists without a system/category rule.

### C11 — Subprocessors and international transfers

Required evidence:
- current subprocessor register, service, purpose, categories, locations and contract owner;
- security/privacy review before onboarding;
- notice/contract mechanism for material changes;
- valid international-transfer mechanism for each applicable flow;
- ANPD standard contractual clauses incorporated without unauthorized modification when that is the selected mechanism;
- public transparency on destination/purpose/responsibilities/rights where required.

Failure condition: a global cloud/vendor processes personal data abroad without a documented transfer mechanism.

### C12 — Cookies, analytics and marketing

Required evidence:
- necessary cookies separated from optional cookies;
- optional analytics/marketing activated only under the applicable lawful model;
- preference/revocation control where consent is used;
- no dark patterns;
- outbound commercial communications include lawful purpose and practical opt-out;
- suppression list prevents re-enrollment after opt-out unless a new valid basis exists.

Failure condition: marketing consent is bundled with mandatory service access without necessity.

### C13 — Consumer protection and contracting

When PF or another party qualifies as consumer:
- terms must be readable, accessible and presented before acceptance;
- material limitation/exclusion clauses must be prominent and cannot waive mandatory rights;
- no unilateral price/service change without the agreed notice/right protections;
- cancellation/refund/renewal flows must comply with mandatory consumer rules applicable to the sale channel;
- service advertisements must match actual capabilities;
- evidence of the accepted version must be immutable/auditable;
- forum, liability and indemnity wording cannot attempt to exclude non-waivable statutory protections.

Failure condition: legal text claims 'no refunds', 'no liability' or unrestricted unilateral changes regardless of mandatory law.

### C14 — Government/law-enforcement requests

Required evidence:
- verify competence, authenticity and scope of requests;
- disclose only the legally required minimum;
- preserve confidentiality/secrecy orders;
- record request, legal basis, approving person and data produced;
- notify customer/subject when permitted and contractually appropriate;
- reject or challenge manifestly invalid/overbroad requests through counsel when appropriate.

Failure condition: support staff exports customer data based only on an informal email request.

### C15 — Vendor confidentiality and workforce access

Required evidence:
- confidentiality obligations before privileged access;
- access granted by role and revoked on termination/change;
- device/account security requirements;
- no production data in uncontrolled personal tools;
- incident reporting duty;
- periodic privileged-access review.

### C16 — Evidence, audit and legal defensibility

Required evidence must be timestamped and attributable. At minimum retain, under the applicable retention schedule:
- versions of terms/privacy/DPA and acceptance records;
- security and deployment evidence;
- DSAR cases and decisions;
- DPIAs/RIPDs and legitimate-interest assessments;
- incident records and notices;
- vendor/subprocessor reviews and transfer mechanism evidence;
- deletion/legal-hold records;
- training/access review records;
- material customer notices.

## Release gate for privacy-impacting features

A feature cannot be considered ready when it creates or materially changes personal-data processing unless the PR/spec answers all of the following:
1. What data is processed?
2. Who are the subjects?
3. Who is controller/operator?
4. What is the specific purpose?
5. What is the legal basis?
6. Is any data sensitive, biometric, child/adolescent or high-risk?
7. Which tenant/auth controls apply?
8. Who receives the data?
9. Is there an international transfer and what mechanism applies?
10. What is the retention/deletion rule?
11. How can the subject exercise rights?
12. What logging/audit evidence exists?
13. Does a DPIA/RIPD or legitimate-interest assessment apply?
14. What happens on contract termination?
15. What is the rollback plan?

Any unanswered item is a release blocker unless formally documented as not applicable with rationale.

## Definition of 100% operational readiness

For internal scoring, 100% means all applicable controls above have: (a) a documented rule, (b) an accountable owner, (c) an executable process, and (d) verifiable evidence. It does not mean zero legal risk, immunity from lawsuits, or a guarantee that a court/authority will agree with every interpretation. Final contract/publication changes require review by Brazilian counsel experienced in privacy, consumer and SaaS contracting.