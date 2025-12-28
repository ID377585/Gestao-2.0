"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  orderId: string | undefined;
  onUpdate: () => void;
};

export function useOrderRealtime({ orderId, onUpdate }: Props) {
  useEffect(() => {
    if (!orderId) return;

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          // sempre que o pedido mudar, chamamos o callback
          onUpdate();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_status_events",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          // sempre que entrar um novo evento na timeline
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // se der erro na remoção, ignoramos silenciosamente
      }
    };
  }, [orderId, onUpdate]);
}
