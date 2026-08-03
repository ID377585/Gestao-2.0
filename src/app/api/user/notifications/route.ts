import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/security/rate-limit";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getCurrentTenantForUser } from "@/lib/tenant/get-current-tenant";

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
  const establishmentId =
    row.establishment_id ??
    payload?.establishment_id ??
    payload?.establishmentId ??
    null;

  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    establishmentId: establishmentId ? String(establishmentId) : null,
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
  userId: string,
  establishmentId?: string | null
) {
  let query = supabase
    .from("notifications")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (establishmentId) {
    query = query.eq("establishment_id", establishmentId);
  } else {
    query = query.or(`user_id.eq.${userId},userId.eq.${userId}`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rowsById = new Map<string, Record<string, any>>();

  for (const row of data ?? []) {
    rowsById.set(String((row as any).id), row as Record<string, any>);
  }

  if (establishmentId) {
    try {
      const { data: payloadRows, error: payloadError } = await supabase
        .from("notifications")
        .select("*")
        .contains("payload", { establishment_id: establishmentId })
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (payloadError) throw payloadError;

      for (const row of payloadRows ?? []) {
        rowsById.set(String((row as any).id), row as Record<string, any>);
      }
    } catch (payloadError) {
      if (!isSchemaCompatibilityError(payloadError)) {
        throw payloadError;
      }
    }
  }

  return Array.from(rowsById.values()).sort((a, b) =>
    String(b.created_at ?? b.createdAt ?? "").localeCompare(
      String(a.created_at ?? a.createdAt ?? "")
    )
  );
}

async function listFromPayloadScopedSchema(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .contains("payload", { establishment_id: establishmentId })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

function chunkValues<T>(values: T[], size = 100) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function listActiveMembershipRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  tableName: "memberships" | "establishment_memberships",
  filters: { establishmentId?: string | null; userIds?: string[] } = {}
) {
  let query = supabase
    .from(tableName)
    .select("user_id,establishment_id")
    .eq("is_active", true)
    .not("establishment_id", "is", null);

  if (filters.establishmentId) {
    query = query.eq("establishment_id", filters.establishmentId);
  }

  if (filters.userIds?.length) {
    query = query.in("user_id", filters.userIds);
  }

  const { data, error } = await query;

  if (error) {
    if (!isSchemaCompatibilityError(error)) {
      console.warn("[notifications] membership fallback:", {
        table: tableName,
        code: error.code,
        message: error.message,
      });
    }

    return [];
  }

  return (data ?? [])
    .filter((row: any) => row?.user_id && row?.establishment_id)
    .map((row: any) => ({
      userId: String(row.user_id),
      establishmentId: String(row.establishment_id),
    }));
}

async function listSafeLegacyRecipientIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string
) {
  const currentRows = [
    ...(await listActiveMembershipRows(supabase, "memberships", {
      establishmentId,
    })),
    ...(await listActiveMembershipRows(supabase, "establishment_memberships", {
      establishmentId,
    })),
  ];

  const candidateUserIds = Array.from(
    new Set(currentRows.map((row) => row.userId).filter(Boolean))
  );

  if (candidateUserIds.length === 0) return [];

  const activeEstablishmentsByUserId = new Map<string, Set<string>>();

  for (const userIds of chunkValues(candidateUserIds)) {
    const rows = [
      ...(await listActiveMembershipRows(supabase, "memberships", { userIds })),
      ...(await listActiveMembershipRows(supabase, "establishment_memberships", {
        userIds,
      })),
    ];

    for (const row of rows) {
      const establishments =
        activeEstablishmentsByUserId.get(row.userId) ?? new Set<string>();
      establishments.add(row.establishmentId);
      activeEstablishmentsByUserId.set(row.userId, establishments);
    }
  }

  return candidateUserIds.filter((userId) => {
    const establishments = activeEstablishmentsByUserId.get(userId);
    return establishments?.size === 1 && establishments.has(establishmentId);
  });
}

async function listLegacyRowsForSingleCompanyRecipients(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string
) {
  const recipientIds = await listSafeLegacyRecipientIds(supabase, establishmentId);
  const rowsById = new Map<string, Record<string, any>>();

  if (recipientIds.length === 0) return [];

  for (const userIds of chunkValues(recipientIds, 50)) {
    const queries = [
      supabase
        .from("notifications")
        .select("*")
        .in("user_id", userIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notifications")
        .select("*")
        .in("userId", userIds)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
    ];

    for (const query of queries) {
      const { data, error } = await query;

      if (error) {
        if (!isSchemaCompatibilityError(error)) {
          console.warn("[notifications] legacy company fallback:", {
            code: error.code,
            message: error.message,
          });
        }

        continue;
      }

      for (const row of data ?? []) {
        rowsById.set(String((row as any).id), {
          ...(row as Record<string, any>),
          establishment_id:
            (row as any).establishment_id ??
            (row as any).payload?.establishment_id ??
            establishmentId,
        });
      }
    }
  }

  return Array.from(rowsById.values()).sort((a, b) =>
    String(b.created_at ?? b.createdAt ?? "").localeCompare(
      String(a.created_at ?? a.createdAt ?? "")
    )
  );
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

    const tenant = await getCurrentTenantForUser(supabase, {
      id: user.id,
      email: user.email ?? null,
    });

    if (!tenant?.establishmentId) {
      return NextResponse.json({ notifications: [] }, { status: 200 });
    }

    let scopedSupabase: typeof supabase = supabase;

    try {
      scopedSupabase = getSupabaseAdminClient() as typeof supabase;
    } catch (adminError) {
      console.warn("[notifications] admin fallback unavailable:", adminError);
    }

    const loaders = [
      (client: typeof supabase, id: string) =>
        listFromCurrentSchema(client, id, tenant.establishmentId),
      (client: typeof supabase) =>
        listFromPayloadScopedSchema(client, tenant.establishmentId),
      (client: typeof supabase) =>
        listLegacyRowsForSingleCompanyRecipients(
          client,
          tenant.establishmentId
        ),
    ];

    const rowsById = new Map<string, Record<string, any>>();

    for (const loader of loaders) {
      try {
        const rows = await loader(scopedSupabase, user.id);

        for (const row of rows) {
          rowsById.set(String((row as any).id), row as Record<string, any>);
        }
      } catch (error) {
        if (!isSchemaCompatibilityError(error)) {
          console.warn("[notifications] read fallback:", error);
        }
      }
    }

    const rows = Array.from(rowsById.values()).sort((a, b) =>
      String(b.created_at ?? b.createdAt ?? "").localeCompare(
        String(a.created_at ?? a.createdAt ?? "")
      )
    );

    return NextResponse.json(
      { notifications: rows.map((row) => normalizeNotification(row)) },
      { status: 200 }
    );
  } catch (error) {
    console.warn("[notifications] read unavailable:", error);

    return NextResponse.json({ notifications: [] }, { status: 200 });
  }
}
