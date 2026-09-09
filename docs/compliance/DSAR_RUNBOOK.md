# Gestify — Data Subject Rights (DSAR) Runbook

Status: implementing
Owner: Privacy / Encarregado
Last review: 2026-09-09

## Intake

Accepted channel: atendimento@ntsolution.com.br and any future authenticated privacy portal.

Every request must receive a case ID and record:
- received_at;
- requester identity/contact;
- represented person/company, when applicable;
- requested right;
- data/system/tenant scope;
- controller/operator role;
- identity verification method;
- applicable deadline;
- legal hold or retention exception;
- actions taken;
- approver;
- response date and evidence.

Do not request sensitive identity documents unless proportionate and necessary. If identity cannot be reliably verified, ask only for the minimum additional information required.

## Triage

Within one business day:
1. classify the right: confirmation/access, correction, deletion/blocking/anonymization, portability, sharing information, consent revocation, opposition, automated-decision review, explanation or other;
2. determine whether Gestify is Controller or Operator for the requested data;
3. identify tenant(s) and prevent cross-tenant disclosure;
4. determine whether the request is manifestly impossible, legally restricted or requires clarification;
5. set deadline and owner.

## Controller versus Operator

When Gestify is Controller, it is responsible for the response under applicable law.

When a customer is Controller and Gestify is Operator:
- acknowledge receipt without making legal decisions on behalf of the customer;
- identify and securely notify the controller customer;
- preserve the request and evidence;
- execute documented technical instructions that are lawful and within contract;
- do not disclose one customer's data to a requester without proper controller authorization unless Gestify has an independent legal duty.

## Access and confirmation

- Provide confirmation and simplified access promptly when applicable.
- For a complete response requiring origin, criteria, purpose and other detailed treatment information, observe the applicable LGPD/ANPD deadline; the operational target is to complete well before the legal maximum.
- Export only data tied to the verified requester and authorized tenant scope.
- Remove secrets, internal security details, third-party personal data and privileged/confidential information that cannot lawfully be disclosed.

## Correction

- Confirm which source is authoritative.
- Correct data under Gestify's control or route the correction to the customer Controller.
- Preserve only the minimum audit evidence required to show that a correction occurred; do not keep obsolete content indefinitely unless legally necessary.

## Deletion / blocking / anonymization

Before deletion:
1. verify identity and scope;
2. identify legal basis for current retention;
3. check legal hold, tax/accounting, fraud/security, contract dispute and exercise-of-rights exceptions;
4. identify primary data, replicas, exports and backups;
5. determine whether deletion, blocking or anonymization is the legally/technically appropriate action;
6. approve the execution and record evidence.

Never promise instant backup deletion when infrastructure operates on an expiration cycle. Deleted production data must not be intentionally restored into active use after a valid deletion, except where a legitimate disaster recovery restoration requires re-applying the deletion before returning the restored environment to normal operation.

## Consent revocation and opposition

Where consent is the legal basis:
- record revocation timestamp;
- stop future consent-based processing as soon as operationally possible;
- keep only evidence/records lawfully required;
- do not require the user to provide a reason.

For opposition:
- identify the treatment and legal basis;
- assess whether the processing is in compliance and whether continuation is legally justified;
- escalate legal disagreements to counsel/Encarregado.

## Automated decisions

If the request concerns solely automated processing that affects the person's interests:
- identify the system/model/rule used;
- provide legally required information on relevant criteria/procedures without exposing protected trade secrets or security controls beyond what the law requires;
- provide the review/contest path required by applicable law and product policy.

## Response quality

Responses must be:
- free of charge for exercise of statutory rights;
- written in clear language;
- specific to the request;
- consistent with actual technical evidence;
- sent through a channel appropriate to the sensitivity of the response.

Do not send raw database dumps, internal JWTs, password hashes, service keys, security logs of other users or other tenants' data.

## Escalation

Immediate escalation to the Encarregado and legal counsel when:
- request alleges discrimination, biometric misuse, children/adolescent data, health data or other sensitive data;
- requester threatens or has filed ANPD/Procon/court proceedings;
- data spans multiple controllers or contested ownership;
- a legal hold or active litigation conflicts with requested deletion;
- the request exposes a suspected security incident.

## Evidence closure

Close only after:
- response delivered;
- technical actions verified;
- customer/controller confirmation obtained when applicable;
- exceptions documented with legal basis;
- case record is complete and placed under the DSAR retention rule.