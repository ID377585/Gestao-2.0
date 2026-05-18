#!/usr/bin/env node

/**
 * Temporary SaaS production guard.
 *
 * Keep GESTIFY_NEW_SIGNUPS_ENABLED unset/false in Production until the RLS,
 * RPC, storage, dependency and CI hardening checklist is fully applied and
 * verified. This script intentionally does not fail builds; it makes unsafe
 * rollout state visible in Vercel/GitHub logs without blocking local installs.
 */

const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
const signupsEnabled = String(process.env.GESTIFY_NEW_SIGNUPS_ENABLED || "").toLowerCase() === "true";
const hardeningConfirmed = String(process.env.GESTIFY_SECURITY_HARDENING_CONFIRMED || "").toLowerCase() === "true";

if (isProduction && signupsEnabled && !hardeningConfirmed) {
  console.warn(
    [
      "[gestify-security] New signups are enabled before security hardening is confirmed.",
      "Set GESTIFY_NEW_SIGNUPS_ENABLED=false or set GESTIFY_SECURITY_HARDENING_CONFIRMED=true only after the hardening checklist is verified.",
    ].join(" ")
  );
}
