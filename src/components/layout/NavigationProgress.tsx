"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;

    const timeout = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (destination.origin !== current.origin) return;
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      setVisible(true);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 overflow-hidden bg-blue-100/70 dark:bg-slate-800"
        aria-hidden="true"
      >
        <div className="navigation-progress__bar h-full w-2/5 bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.55)] dark:bg-blue-400" />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        Carregando nova página
      </span>
    </>
  );
}
