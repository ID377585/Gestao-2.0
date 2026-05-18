export function areNewGestifySignupsEnabled() {
  return process.env.GESTIFY_NEW_SIGNUPS_ENABLED === "true";
}

export function assertNewGestifySignupsEnabled() {
  if (!areNewGestifySignupsEnabled()) {
    throw new Error(
      "Novos cadastros do Gestify estao temporariamente congelados ate a conclusao das correcoes de seguranca SaaS."
    );
  }
}
