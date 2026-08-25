const PRODUCTION_PROJECT_REF = 'ubwbnpckbwtllitonpjj';
const STAGING_PROJECT_REF = 'tuncavkhjazruijujatb';

export function extractProjectRef(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function assertSafeQaWriteTarget({
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  projectRef = process.env.SUPABASE_PROJECT_REF,
  allowWrites = process.env.GESTIFY_QA_ALLOW_WRITES,
} = {}) {
  const resolvedRef = projectRef || extractProjectRef(supabaseUrl);

  if (!resolvedRef) throw new Error('QA write guard: unable to resolve Supabase project ref. Refusing mutation.');
  if (resolvedRef === PRODUCTION_PROJECT_REF) {
    throw new Error(`QA write guard: production project ${PRODUCTION_PROJECT_REF} is immutable for QA/E2E automation.`);
  }
  if (resolvedRef !== STAGING_PROJECT_REF) {
    throw new Error(`QA write guard: mutations are allowed only on gestify-staging (${STAGING_PROJECT_REF}); got ${resolvedRef}.`);
  }
  if (allowWrites !== 'true') {
    throw new Error('QA write guard: set GESTIFY_QA_ALLOW_WRITES=true explicitly for staging-only mutation tests.');
  }

  return { projectRef: resolvedRef, environment: 'staging' };
}

export const GESTIFY_PRODUCTION_PROJECT_REF = PRODUCTION_PROJECT_REF;
export const GESTIFY_STAGING_PROJECT_REF = STAGING_PROJECT_REF;
