import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  addDoc,
  serverTimestamp,
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
  createdAt?: Timestamp | null;
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
      })
    );

  await Promise.all(pending);
}

export async function createNotification(params: {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
}) {
  await addDoc(collection(db, "notifications"), {
    userId: params.userId,
    titulo: params.titulo,
    mensagem: params.mensagem,
    tipo: params.tipo,
    lida: false,
    createdAt: serverTimestamp(),
  });
}