# Gestify — Consumer and SaaS Contract Guardrails

Status: implementing
Owner: Legal + Commercial + Product
Last review: 2026-09-09

## Purpose

Prevent contractual language, sales promises, cancellation flows and liability terms from creating avoidable exposure under Brazilian law. This standard applies to B2B contracting and must be strengthened whenever the counterparty or end user can legally qualify as a consumer.

## Contract hierarchy

The contract package must identify, in order of specificity:
1. signed order form/commercial proposal;
2. master SaaS/service terms;
3. SLA, if contracted;
4. DPA/privacy annex;
5. security/technical annex where applicable;
6. acceptable use policy;
7. public policies incorporated by reference only when version/date and change rules are clear.

No web page may silently override a signed specific term to the customer's detriment.

## Mandatory clear terms

Every commercial contract must state specifically:
- legal contracting entity and CNPJ;
- customer entity/person and authorized representative;
- product/modules and quantities/limits;
- price, taxes, billing cycle, due date and adjustment rule;
- effective date, term and renewal model;
- cancellation/non-renewal procedure and notice;
- implementation/support responsibilities;
- service availability/SLA only if actually measured and supportable;
- ownership/license of software and ownership/control of customer data;
- confidentiality;
- data protection roles and DPA incorporation;
- termination export/deletion process;
- suspension conditions, including cure period where appropriate;
- prohibited use;
- security responsibilities of both parties;
- liability allocation without excluding mandatory liability;
- dispute/notice process;
- governing law and venue subject to mandatory consumer/jurisdiction rules.

## Prohibited/vulnerable wording

Do not publish or sign clauses that purport to:
- exclude all liability for data breach, gross negligence, intentional misconduct or obligations that law makes non-waivable;
- say the service is '100% secure', 'unhackable', 'always available' or guarantees zero data loss;
- permit unrestricted unilateral price/feature/terms changes without notice and applicable rights;
- waive statutory consumer rights by a generic click;
- impose a forum that cannot legally bind a consumer;
- authorize any use/sale of customer personal data without purpose/legal basis;
- retain all customer data forever after termination;
- automatically convert optional marketing consent into a condition of service where not necessary;
- make the customer solely responsible for every privacy/security incident regardless of Gestify's own conduct;
- disclaim responsibility for subprocessors in a manner inconsistent with law/contract;
- allow disclosure of customer data to any requester without legal verification.

## Sales and advertising control

Commercial, landing-page and proposal claims must match evidence. Before publishing claims such as:
- LGPD compliant;
- certified;
- encrypted;
- backup guaranteed;
- 99.9% uptime;
- PCI compliant;
- automatic fiscal/legal compliance;
- fraud proof;
- biometric accuracy;
- AI accuracy;
there must be documented evidence and an approved definition/scope.

A readiness score or internal control framework is not a legal certification.

## PF / consumer safeguards

When the contracting party/end user falls under consumer protection rules:
- provide terms before conclusion in clear Portuguese;
- highlight clauses limiting rights or imposing material obligations;
- avoid dark patterns in acceptance, renewal and cancellation;
- preserve proof of offer, accepted terms, price and confirmation;
- apply legally required cooling-off/cancellation/refund rights when the statutory conditions are met;
- offer accessible support and complaint handling;
- do not create unreasonable barriers to cancellation or exercise of privacy rights;
- do not condition statutory rights on waiver of complaints or litigation.

## PJ contracting

A CNPJ does not automatically eliminate consumer-law risk. Commercial/legal review must consider whether the customer is a final recipient/vulnerable party under the specific relationship. Contracts should remain clear and proportionate even when the relationship is purely business-to-business.

## Suspension and termination

Suspension should be tied to objective events: nonpayment, security risk, illegal use, material breach or emergency protection. Except when immediate action is necessary for security/legal reasons:
- provide notice;
- identify the breach;
- allow a reasonable cure path when contractually appropriate;
- preserve lawful access/export rights during termination as defined by contract;
- avoid destroying data while a valid dispute/legal hold applies.

## Limitation of liability design

Any cap/exclusion must be drafted by counsel for the actual customer profile and cannot attempt to override mandatory law. The contract should separately address, where legally appropriate:
- direct damages;
- indirect/lost-profit exclusions;
- aggregate cap;
- carve-outs for intentional misconduct, gross negligence, confidentiality, IP, data-protection obligations or other non-waivable duties;
- customer indemnity for unlawful customer-provided content/instructions;
- Gestify responsibility for its own breaches.

## Evidence of acceptance

The acceptance ledger must be append-only/auditable and record at minimum:
- user/account;
- tenant/customer;
- document identifier and version;
- exact title;
- acceptance timestamp;
- channel/context;
- affirmative action;
- source metadata reasonably necessary for evidentiary integrity.

Changing a document must create a new version; do not rewrite history for previously accepted text.

## Legal review gate

Before release to production, material changes to Terms, DPA, pricing/renewal, liability, cancellation, SLA, privacy notices or sensitive-data use require review by Brazilian counsel experienced in SaaS/privacy/consumer matters. Product/engineering may prepare precise drafts and evidence, but cannot certify a legal interpretation as risk-free.