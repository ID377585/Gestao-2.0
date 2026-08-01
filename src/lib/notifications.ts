import { supabase } from "@/lib/supabase";

export type NotificationType = "info" | "success" | "warning" | "error";
export type NotificationPriority = "critical" | "high" | "normal" | "info";

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string | null;
  archivedAt?: string | null;
  type?: NotificationType | string;
  priority?: NotificationPriority;
  href?: string | null;
  actionUrl?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
};

function normalizeType(value: unknown, priority?: NotificationPriority): NotificationType | string {
  const raw = String(value ?? "").trim();
  if (["info", "success", "warning", "error"].includes(raw)) return raw;
  if (priority === "critical") return "error";
  if (priority === "high") return "warning";
  return raw || "info";
}

function normalizePriority(value: unknown): NotificationPriority {
  const raw = String(value ?? "normal").trim();
  if (["critical", "high", "normal", "info"].includes(raw)) {
    return raw as NotificationPriority;
  }
  return "normal";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function serializeNotificationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return String(error ?? "Erro desconhecido");
  }

  const candidate = error as {
    message?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    status?: unknown;
    name?: unknown;
  };

  return {
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    message: typeof candidate.message === "string" ? candidate.message : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    details: typeof candidate.details === "string" ? candidate.details : undefined,
    hint: typeof candidate.hint === "string" ? candidate.hint : undefined,
    status:
      typeof candidate.status === "number" || typeof candidate.status === "string"
        ? candidate.status
        : undefined,
  };
}

const lastSuccessfulNotificationsByUserId = new Map<string, AppNotification[]>();

function normalizeNotification(row: Record<string, any>): AppNotification {
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

async function getUserNotificationsFromApi(userId: string) {
  if (typeof window === "undefined") return null;

  try {
    const response = await fetch("/api/user/notifications", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401) return [];

    if (!response.ok) {
      throw new Error(`Falha ao carregar notificações (${response.status}).`);
    }

    const body = (await response.json().catch(() => ({}))) as {
      notifications?: unknown;
    };
    const notifications = Array.isArray(body.notifications)
      ? body.notifications.map((row) =>
          normalizeNotification(row as Record<string, any>)
        )
      : [];

    lastSuccessfulNotificationsByUserId.set(userId, notifications);
    return notifications;
  } catch {
    return lastSuccessfulNotificationsByUserId.get(userId) ?? [];
  }
}

async function getUserNotificationsFromNewSchema(userId: string) {
  if (!isUuid(userId)) {
    throw new Error("Formato de usuário incompatível com user_id.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => normalizeNotification(row as Record<string, any>));
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
    .order(createdAtColumn, { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => normalizeNotification(row as Record<string, any>));
}

export async function getUserNotifications(userId: string) {
  const safeUserId = String(userId ?? "").trim();

  if (!safeUserId) {
    return [];
  }

  const apiNotifications = await getUserNotificationsFromApi(safeUserId);
  if (apiNotifications) return apiNotifications;

  try {
    const notifications = await getUserNotificationsFromNewSchema(safeUserId);
    lastSuccessfulNotificationsByUserId.set(safeUserId, notifications);
    return notifications;
  } catch {
    try {
      if (!isUuid(safeUserId)) {
        throw new Error("Formato de usuário incompatível com user_id.");
      }

      const notifications = await getUserNotificationsByColumn(
        safeUserId,
        "user_id",
        "created_at"
      );
      lastSuccessfulNotificationsByUserId.set(safeUserId, notifications);
      return notifications;
    } catch {
      try {
        const notifications = await getUserNotificationsByColumn(
          safeUserId,
          "userId",
          "createdAt"
        );
        lastSuccessfulNotificationsByUserId.set(safeUserId, notifications);
        return notifications;
      } catch {
        return lastSuccessfulNotificationsByUserId.get(safeUserId) ?? [];
      }
    }
  }
}

export async function createNotification(params: {
  userId?: string | null;
  title?: string;
  titulo?: string;
  message?: string;
  mensagem?: string;
  type?: NotificationType | string;
  tipo?: NotificationType;
  priority?: NotificationPriority;
  href?: string | null;
  actionUrl?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
}) {
  const title = params.title ?? params.titulo ?? "";
  const message = params.message ?? params.mensagem ?? "";
  const type = params.type ?? params.tipo ?? "info";
  const payload = params.payload ?? params.metadata ?? null;
  const href = params.actionUrl ?? params.href ?? null;

  const newSchemaPayload = {
    user_id: params.userId ?? null,
    title,
    message,
    type,
    priority: params.priority ?? "normal",
    action_url: href,
    payload,
    dedupe_key: params.dedupeKey ?? params.eventKey ?? null,
  };

  let { error } = await supabase.from("notifications").insert(newSchemaPayload);

  if (!error) return;

  const richPayload = {
    user_id: params.userId ?? null,
    title,
    message,
    read: false,
    type,
    href,
    event_key: params.eventKey ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: payload,
    email_sent: params.emailSent ?? false,
  };

  ({ error } = await supabase.from("notifications").insert(richPayload));

  if (!error) return;

  const basicPayload = {
    userId: params.userId ?? "",
    title,
    message,
    read: false,
  };

  ({ error } = await supabase.from("notifications").insert(basicPayload));

  if (error) throw error;
}

export async function markNotificationAsRead(id: string) {
  let { error } = await supabase.rpc("mark_notification_read", { p_id: id });

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id));

  if (!error) return;

  ({ error } = await supabase.from("notifications").update({ read: true }).eq("id", id));

  if (!error) return;

  ({ error } = await supabase.from("notifications").update({ lida: true }).eq("id", id));

  if (error) throw error;
}

export async function markAllNotificationsAsRead(userId: string) {
  let { error } = await supabase.rpc("mark_all_notifications_read", { p_user_id: userId });

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .is("read_at", null));

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false));

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

export async function archiveNotification(id: string) {
  const archivedAt = new Date().toISOString();

  let { error } = await supabase
    .from("notifications")
    .update({ archived_at: archivedAt, read_at: archivedAt })
    .eq("id", id);

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ archivedAt, read: true })
    .eq("id", id));

  if (error) throw error;
}

export async function archiveReadNotifications(userId: string) {
  const archivedAt = new Date().toISOString();

  let { error } = await supabase
    .from("notifications")
    .update({ archived_at: archivedAt })
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .not("read_at", "is", null)
    .is("archived_at", null);

  if (!error) return;

  ({ error } = await supabase
    .from("notifications")
    .update({ archivedAt })
    .eq("userId", userId)
    .eq("read", true));

  if (error) throw error;
}

let notificationAudioContext: AudioContext | null = null;

function getNotificationAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!notificationAudioContext) {
    notificationAudioContext = new AudioContextClass();
  }

  return notificationAudioContext;
}

export async function primeNotificationSound() {
  const context = getNotificationAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    return true;
  } catch {
    return false;
  }
}

export function playNotificationSound(priority: NotificationPriority = "normal") {
  if (typeof window === "undefined") return;

  const context = getNotificationAudioContext();
  if (!context) return;

  const play = () => {
    const tones =
      priority === "critical"
        ? [
            { frequency: 880, start: 0, duration: 0.13, gain: 0.075, type: "square" as OscillatorType },
            { frequency: 660, start: 0.16, duration: 0.16, gain: 0.06, type: "square" as OscillatorType },
          ]
        : [
            { frequency: priority === "high" ? 740 : 620, start: 0, duration: 0.16, gain: 0.045, type: "sine" as OscillatorType },
          ];

    tones.forEach((tone) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + tone.start;
      const stopAt = startAt + tone.duration;

      oscillator.type = tone.type;
      oscillator.frequency.value = tone.frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(stopAt + 0.02);
    });
  };

  try {
    if (context.state === "suspended") {
      void context.resume().then(play).catch(() => undefined);
      return;
    }

    play();
  } catch {
    // Browsers can block audio until the user interacts with the page.
  }
}

function subscribeRealtime(
  userId: string,
  callback: (notifications: AppNotification[]) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
      },
      async () => {
        try {
          callback(await getUserNotifications(userId));
        } catch (error) {
          console.error("Erro ao atualizar notificações em tempo real:", error);
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
) {
  let active = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let loggedFetchError = false;

  async function refresh() {
    try {
      const data = await getUserNotifications(userId);
      loggedFetchError = false;
      if (active) callback(data);
    } catch (error) {
      if (!loggedFetchError) {
        console.error("Erro ao buscar notificações:", serializeNotificationError(error));
        loggedFetchError = true;
      }
    }
  }

  void refresh();
  const unsubscribeRealtime = subscribeRealtime(userId, callback);

  // Polling remains as a fallback for projects where the realtime publication was not enabled yet.
  intervalId = setInterval(refresh, 15000);

  return () => {
    active = false;
    if (intervalId) clearInterval(intervalId);
    unsubscribeRealtime();
  };
}
