"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastVariant = "default" | "destructive";

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const durationMs = input.durationMs ?? 3000;

      const newItem: ToastItem = {
        id,
        variant: input.variant ?? "default",
        title: input.title,
        description: input.description,
        durationMs,
      };

      setItems((prev) => [...prev, newItem]);

      window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* UI do Toast */}
      <div className="fixed right-4 top-4 z-[9999] space-y-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "w-[320px] rounded-md border bg-white p-3 shadow-md",
              t.variant === "destructive" ? "border-red-500" : "border-gray-200",
            ].join(" ")}
          >
            {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
            {t.description ? (
              <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast deve ser usado dentro de <ToastProvider />");
  }
  return ctx;
}
