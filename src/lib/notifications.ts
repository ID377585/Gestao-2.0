import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type NotificationType = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: NotificationType;
  href?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
};

function normalizeNotification(row: Record<string, any>): AppNotification {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    title: String(row.title ?? row.titulo ?? ""),
    message: String(row.message ?? row.mensagem ?? ""),
    read: Boolean(row.read ?? row.lida ?? false),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    type: (row.type ?? row.tipo ?? "info") as NotificationType,
    href: row.href ?? null,
    eventKey: row.event_key ?? row.eventKey ?? null,
    entityType: row.entity_type ?? row.entityType ?? null,
    entityId: row.entity_id ?? row.entityId ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    emailSent:
      typeof row.email_sent === "boolean"
        ? row.email_sent
        : typeof row.emailSent === "boolean"
          ? row.emailSent
          : undefined,
  };
}

async function getUserNotificationsByColumn(
  userId: string,
  userColumn: "user_id" | "userId",
  createdAtColumn: "created_at" | "createdAt"
) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq(userColumn, userId)
    .order(createdAtColumn, { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    normalizeNotification(row as Record<string, any>)
  );
}

export async function getUserNotifications(userId: string) {
  try {
    return await getUserNotificationsByColumn(userId, "user_id", "created_at");
  } catch {
    return getUserNotificationsByColumn(userId, "userId", "createdAt");
  }
}

export async function createNotification(params: {
  userId: string;
  title?: string;
  titulo?: string;
  message?: string;
  mensagem?: string;
  type?: NotificationType;
  tipo?: NotificationType;
  href?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
}) {
  const title = params.title ?? params.titulo ?? "";
  const message = params.message ?? params.mensagem ?? "";
  const type = params.type ?? params.tipo ?? "info";

  const richPayload = {
    user_id: params.userId,
    title,
    message,
    read: false,
    type,
    href: params.href ?? null,
    event_key: params.eventKey ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
    email_sent: params.emailSent ?? false,
  };

  let { error } = await supabase.from("notifications").insert(richPayload);

  if (!error) return;

  const basicPayload = {
    userId: params.userId,
    title,
    message,
    read: false,
  };

  ({ error } = await supabase.from("notifications").insert(basicPayload));

  if (error) throw error;
}

export async function markNotificationAsRead(id: string) {
  let { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("id", id));

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string) {
  let { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("userId", userId)
    .eq("read", false));

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ lida: true })
    .eq("userId", userId)
    .eq("lida", false));

  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
) {
  let active = true;

  async function fetchLoop() {
    while (active) {
      try {
        const data = await getUserNotifications(userId);
        callback(data);
      } catch (error) {
        console.error("Erro ao buscar notificacoes:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  void fetchLoop();

  return () => {
    active = false;
  };
}
