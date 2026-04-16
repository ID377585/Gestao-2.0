import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationType = "info" | "warning" | "success" | "error";

export interface AppNotification {
  id: string;
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
  lida: boolean;
  href?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function sanitizeNotificationKey(value: string) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
}

function buildNotificationDocId(userId: string, eventKey: string) {
  return `${sanitizeNotificationKey(userId)}__${sanitizeNotificationKey(eventKey)}`;
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void
) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const data: AppNotification[] = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<AppNotification, "id">),
      }));

      callback(data);
    },
    (error) => {
      console.error("Erro ao assinar notificações:", error);
      callback([]);
    }
  );
}

export async function markNotificationAsRead(notificationId: string) {
  const ref = doc(db, "notifications", notificationId);
  await updateDoc(ref, {
    lida: true,
    updatedAt: serverTimestamp(),
  });
}

export async function markAllNotificationsAsRead(
  notifications: AppNotification[]
) {
  const pending = notifications
    .filter((item) => !item.lida)
    .map((item) =>
      updateDoc(doc(db, "notifications", item.id), {
        lida: true,
        updatedAt: serverTimestamp(),
      })
    );

  await Promise.all(pending);
}

export async function createNotification(params: {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
  href?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  emailSent?: boolean;
}) {
  const payload = {
    userId: params.userId,
    titulo: params.titulo,
    mensagem: params.mensagem,
    tipo: params.tipo,
    lida: false,
    href: params.href ?? null,
    eventKey: params.eventKey ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? null,
    emailSent: params.emailSent ?? false,
    updatedAt: serverTimestamp(),
  };

  const trimmedEventKey = String(params.eventKey ?? "").trim();

  if (trimmedEventKey) {
    const ref = doc(
      db,
      "notifications",
      buildNotificationDocId(params.userId, trimmedEventKey)
    );

    await setDoc(
      ref,
      {
        ...payload,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      id: ref.id,
      deduplicated: true as const,
    };
  }

  const ref = await addDoc(collection(db, "notifications"), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    deduplicated: false as const,
  };
}

export async function createNotificationsBulk(
  notifications: Array<{
    userId: string;
    titulo: string;
    mensagem: string;
    tipo: NotificationType;
    href?: string | null;
    eventKey?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
    emailSent?: boolean;
  }>
) {
  return Promise.all(notifications.map((item) => createNotification(item)));
}