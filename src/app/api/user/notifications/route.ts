import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NotificationPriority = "critical" | "high" | "normal" | "info";

function normalizePriority(value: unknown): NotificationPriority {
  const raw = String(value ?? "normal").trim();
  if (["critical", "high", "normal", "info"].includes(raw)) {
    return raw as NotificationPriority;
  }

  return "normal";
}

function normalizeType(value: unknown, priority?: NotificationPriority) {
  const raw = String(value ?? "").trim();
  if (["info", "success", "warning", "error"].includes(raw)) return raw;
  if (priority === "critical") return "error";
  if (priority === "high") return "warning";

  return raw || "info";
}

function normalizeNotification(row: Record<string, any>) {
  const priority = normalizePriority(row.priority);
  const readAt = row.read_at ?? row.readAt ?? null;
  const read = Boolean(row.read ?? row.lida ?? readAt ?? false);
  const actionUrl = row.action_url ?? row.actionUrl ?? row.href ?? null;
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : payload;

  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    title: String(row.title ?? row.titulo ?? ""),
    message: String(row.message ?? row.mensagem ?? ""),
    read,
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    readAt,
    archivedAt: row.archived_at ?? row.archivedAt ?? null,
    type: normalizeType(row.type ?? row.tipo, priority),
    priority,
    href: actionUrl,
    actionUrl,
    eventKey: row.event_key ?? row.eventKey ?? null,
    entityType: row.entity_type ?? row.entityType ?? null,
    entityId: row.entity_id ?? row.entityId ?? null,
    dedupeKey: row.dedupe_key ?? row.dedupeKey ?? null,
    payload,
    metadata,
    emailSent:
      typeof row.email_sent === "boolean"
        ? row.email_sent
        : typeof row.emailSent === "boolean"
          ? row.emailSent
          : undefined,
  };
}

function isSchemaCompatibilityError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  const details = String(error?.details ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("column") ||
    details.includes("schema cache") ||
    details.includes("column")
  );
}

async function listFromCurrentSchema(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

async function listFromLegacySnakeSchema(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

async function listFromLegacyCamelSchema(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("userId", userId)
    .order("createdAt", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "user-notifications",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ notifications: [] }, { status: 401 });
    }

    const loaders = [
      listFromCurrentSchema,
      listFromLegacySnakeSchema,
      listFromLegacyCamelSchema,
    ];

    for (const loader of loaders) {
      try {
        const rows = await loader(supabase, user.id);

        return NextResponse.json(
          { notifications: rows.map((row) => normalizeNotification(row)) },
          { status: 200 }
        );
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) {
          console.warn("[notifications] read fallback:", error);
        }
      }
    }

    return NextResponse.json({ notifications: [] }, { status: 200 });
  } catch (error) {
    console.warn("[notifications] read unavailable:", error);

    return NextResponse.json({ notifications: [] }, { status: 200 });
  }
}
