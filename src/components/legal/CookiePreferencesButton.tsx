"use client";

import { requestCookiePreferencesPanel } from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

type CookiePreferencesButtonProps = {
  className?: string;
};

export function CookiePreferencesButton({
  className,
}: CookiePreferencesButtonProps) {
  return (
    <button
      type="button"
      onClick={() => requestCookiePreferencesPanel({ expandPreferences: true })}
      className={cn(
        "text-sm font-medium text-slate-300 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        className
      )}
    >
      Preferências de cookies
    </button>
  );
}
