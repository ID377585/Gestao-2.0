"use client";

import { useEffect } from "react";

import { ToastProvider } from "@/hooks/use-toast";
import { ThemeProvider } from "@/components/theme-provider";

function isExpectedMediaAbort(error: any) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    (name === "AbortError" || message.includes("aborterror")) &&
    (message.includes("interrupted by a new load request") ||
      message.includes("interrupted by a call to pause"))
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isExpectedMediaAbort(event.reason)) {
        event.preventDefault();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (isExpectedMediaAbort(event.error) || isExpectedMediaAbort(event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
