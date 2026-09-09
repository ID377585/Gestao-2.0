import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'docs/compliance/LGPD_CONTROL_FRAMEWORK.md',
  'docs/compliance/DSAR_RUNBOOK.md',
  'docs/compliance/RIPD_DPIA_STANDARD.md',
  'docs/compliance/ROPA_PROCESSING_REGISTER.md',
  'docs/compliance/SUBPROCESSOR_TRANSFER_REGISTER.md',
  'docs/compliance/RETENTION_DELETION_LEGAL_HOLD.md',
  'docs/compliance/CONSUMER_AND_SAAS_CONTRACT_GUARDRAILS.md',
  'docs/legal/DPA_VNEXT_DRAFT.md',
  'docs/legal/TERMS_VNEXT_CHANGESET.md',
  'docs/security/LGPD_INCIDENT_RESPONSE_RUNBOOK.md',
  'src/lib/data-governance-content.ts',
];

const failures = [];
const read = (file) => {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`missing required compliance file: ${file}`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
};

const corpus = new Map(requiredFiles.map((file) => [file, read(file)]));
const governance = corpus.get('src/lib/data-governance-content.ts') || '';
const incident = corpus.get('docs/security/LGPD_INCIDENT_RESPONSE_RUNBOOK.md') || '';
const controls = corpus.get('docs/compliance/LGPD_CONTROL_FRAMEWORK.md') || '';
const retention = corpus.get('docs/compliance/RETENTION_DELETION_LEGAL_HOLD.md') || '';
const transfer = corpus.get('docs/compliance/SUBPROCESSOR_TRANSFER_REGISTER.md') || '';
const dsar = corpus.get('docs/compliance/DSAR_RUNBOOK.md') || '';
const ropa = corpus.get('docs/compliance/ROPA_PROCESSING_REGISTER.md') || '';
const ripd = corpus.get('docs/compliance/RIPD_DPIA_STANDARD.md') || '';
const contract = corpus.get('docs/compliance/CONSUMER_AND_SAAS_CONTRACT_GUARDRAILS.md') || '';
const dpaDraft = corpus.get('docs/legal/DPA_VNEXT_DRAFT.md') || '';
const termsDraft = corpus.get('docs/legal/TERMS_VNEXT_CHANGESET.md') || '';

const requireText = (label, text, patterns) => {
  for (const pattern of patterns) {
    if (!pattern.test(text)) failures.push(`${label}: missing ${pattern}`);
  }
};

requireText('public governance', governance, [
  /updatedAt:\s*"09\/09\/2026"/,
  /3 dias úteis/i,
  /24 horas/i,
  /15 dias/i,
  /Resolução CD\/ANPD nº 19\/2024/i,
  /biom[eé]tric/i,
  /Crianças, adolescentes/i,
  /Decisões automatizadas/i,
  /solicitações governamentais/i,
  /legal hold/i,
]);

requireText('incident response', incident, [
  /personal_data_impact_known_at/,
  /controller_notified_at/,
  /24 horas/i,
  /3 dias úteis/i,
  /Resolução CD\/ANPD nº 15\/2024/i,
  /SEV-1/,
]);

requireText('control framework', controls, [
  /C01 — Governance/,
  /C16 — Evidence/,
  /Release gate for privacy-impacting features/,
  /zero legal risk/i,
]);

requireText('retention standard', retention, [
  /Marco Civil/i,
  /6 \(seis\) meses|six-month|seis meses/i,
  /Legal hold/i,
  /backup/i,
  /Biometric/i,
]);

requireText('transfer register', transfer, [
  /Transfer mechanism/,
  /ANPD standard clauses/i,
  /destination country/i,
  /Offboarding/,
]);

requireText('DSAR', dsar, [
  /case ID/i,
  /identity verification/i,
  /Controller versus Operator/i,
  /Automated decisions/i,
  /legal hold/i,
]);

requireText('ROPA', ropa, [
  /ROPA-001/,
  /ROPA-009/,
  /Legal basis/,
  /Transfer mechanism/,
  /DPIA\/RIPD/,
]);

requireText('RIPD', ripd, [
  /biometric/i,
  /children\/adolescent/i,
  /Automated decision\/AI/i,
  /critical residual risk/i,
]);

requireText('contract guardrails', contract, [
  /Prohibited\/vulnerable wording/,
  /consumer/i,
  /Evidence of acceptance/,
  /Legal review gate/,
  /100% secure/i,
]);

requireText('DPA vNext draft', dpaDraft, [
  /instruções documentadas/i,
  /instrução aparentar violar/i,
  /24 horas/i,
  /Resolução CD\/ANPD nº 19\/2024/i,
  /Suboperadores/i,
  /RIPD/i,
  /Ordens judiciais/i,
  /não publicar sem revisão jurídica/i,
]);

requireText('Terms vNext changeset', termsDraft, [
  /aceite afirmativo/i,
  /CDC/i,
  /biometria facial/i,
  /Responsabilidade/i,
  /CURRENT_TERMS_VERSION_ID/,
  /revisão jurídica brasileira/i,
]);

// Guard against accidental legal overclaims in the public governance policy.
for (const forbidden of [/100% seguro/i, /inviol[aá]vel/i, /zero risco/i, /nenhum processo/i, /garantia de.*LGPD/i]) {
  if (forbidden.test(governance)) failures.push(`public governance contains prohibited legal/security overclaim: ${forbidden}`);
}

if (failures.length) {
  console.error('LGPD/compliance readiness audit failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`LGPD/compliance readiness audit OK (${requiredFiles.length} required artifacts).`);
