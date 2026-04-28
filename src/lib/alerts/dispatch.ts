import "server-only";

import { createClient } from "@supabase/supabase-js";
import { type NotificationType } from "@/lib/notifications";
import { DEFAULT_USER_SETTINGS } from "@/lib/user-settings";
import { buildAlertEmailHtml, sendAlertEmail } from "@/lib/alerts/email";

type NotificationPreferenceRow = {
  user_id: string;
  email_notifications: boolean | null;
  browser_notifications: boolean | null;
  dark_mode: boolean | null;
};

export type AlertRecipient = {
  userId: string;
  email?: string | null;
  name?: string | null;
};

export type DispatchAlertInput = {
  recipients: AlertRecipient[];
  titulo: string;
  mensagem: string;
  tipo?: NotificationType;
  href?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  sendEmail?: boolean;
  emailSubject?: string | null;
};

function getSupabaseAdminForAlerts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ENV ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function uniqueRecipients(recipients: AlertRecipient[]) {
  const map = new Map<string, AlertRecipient>();

  for (const recipient of recipients) {
    if (!recipient?.userId) continue;

    const current = map.get(recipient.userId);

    map.set(recipient.userId, {
      userId: recipient.userId,
      email: recipient.email ?? current?.email ?? null,
      name: recipient.name ?? current?.name ?? null,
    });
  }

  return Array.from(map.values());
}

export function buildAlertEventKey(
  ...parts: Array<string | number | null | undefined>
) {
  return parts
    .filter(
      (part) => part !== null && part !== undefined && String(part).trim() !== ""
    )
    .map((part) => String(part).trim())
    .join(":");
}

async function listAuthEmailsByUserIds(userIds: string[]) {
  const supabaseAdmin = getSupabaseAdminForAlerts();
  const idsSet = new Set(userIds);
  const emailById = new Map<string, string>();
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Erro ao listar usuários do Auth para alertas:", error);
      throw new Error("Não foi possível carregar os emails dos destinatários.");
    }

    const users = data?.users ?? [];

    for (const user of users) {
      if (user?.id && idsSet.has(String(user.id)) && user.email) {
        emailById.set(String(user.id), user.email);
      }
    }

    if (users.length < perPage) break;
  }

  return emailById;
}

async function createNotificationAsAdmin(params: {
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
  const supabaseAdmin = getSupabaseAdminForAlerts();

  const richPayload = {
    user_id: params.userId,
    title: params.titulo,
    message: params.mensagem,
    read: false,
    type: params.tipo,
    href: params.href ?? null,
    event_key: params.eventKey ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
    email_sent: params.emailSent ?? false,
  };

  let { error } = await supabaseAdmin.from("notifications").insert(richPayload);

  if (!error) return;

  const basicPayload = {
    userId: params.userId,
    title: params.titulo,
    message: params.mensagem,
    read: false,
  };

  ({ error } = await supabaseAdmin.from("notifications").insert(basicPayload));

  if (error) {
    console.error("Erro ao criar notificação com service role:", error);
    throw error;
  }
}

export async function getNotificationPreferencesByUserIds(userIds: string[]) {
  if (!userIds.length) {
    return new Map<string, NotificationPreferenceRow>();
  }

  const supabaseAdmin = getSupabaseAdminForAlerts();

  const { data, error } = await supabaseAdmin
    .from("user_notification_preferences")
    .select("user_id, email_notifications, browser_notifications, dark_mode")
    .in("user_id", userIds);

  if (error) {
    console.error("Erro ao carregar preferências de notificação:", error);
    throw new Error("Não foi possível carregar as preferências de notificação.");
  }

  const map = new Map<string, NotificationPreferenceRow>();

  for (const row of (data ?? []) as NotificationPreferenceRow[]) {
    map.set(String(row.user_id), row);
  }

  return map;
}

export async function resolveRecipientsByRoles(params: {
  establishmentId: string;
  roles: string[];
}) {
  const supabaseAdmin = getSupabaseAdminForAlerts();

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("establishment_memberships")
    .select("user_id, role")
    .eq("establishment_id", params.establishmentId)
    .eq("is_active", true)
    .in("role", params.roles);

  if (membershipError) {
    console.error("Erro ao buscar recipients por role:", membershipError);
    throw new Error("Não foi possível carregar os destinatários do alerta.");
  }

  const userIds = Array.from(
    new Set((memberships ?? []).map((item: any) => String(item.user_id)))
  );

  if (!userIds.length) return [];

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  if (profileError) {
    console.error("Erro ao buscar perfis para alertas:", profileError);
    throw new Error("Não foi possível carregar os nomes dos destinatários.");
  }

  const nameById = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    nameById.set(String((profile as any).id), (profile as any).full_name ?? null);
  }

  const emailById = await listAuthEmailsByUserIds(userIds);

  return userIds.map((userId) => ({
    userId,
    email: emailById.get(userId) ?? null,
    name: nameById.get(userId) ?? null,
  }));
}

export async function resolveAdminAndOperationRecipients(
  establishmentId: string
) {
  return resolveRecipientsByRoles({
    establishmentId,
    roles: ["admin", "operacao"],
  });
}

export async function dispatchAlert(input: DispatchAlertInput) {
  const recipients = uniqueRecipients(input.recipients);

  if (!recipients.length) {
    return {
      notificationsCreated: 0,
      emailsSent: 0,
      emailSkipped: 0,
    };
  }

  const preferencesMap = await getNotificationPreferencesByUserIds(
    recipients.map((item) => item.userId)
  );

  const missingEmailIds = recipients
    .filter((item) => !item.email)
    .map((item) => item.userId);

  const authEmailMap = missingEmailIds.length
    ? await listAuthEmailsByUserIds(missingEmailIds)
    : new Map<string, string>();

  let notificationsCreated = 0;
  let emailsSent = 0;
  let emailSkipped = 0;

  for (const recipient of recipients) {
    const preferences = preferencesMap.get(recipient.userId);

    await createNotificationAsAdmin({
      userId: recipient.userId,
      titulo: input.titulo,
      mensagem: input.mensagem,
      tipo: input.tipo ?? "info",
      href: input.href ?? null,
      eventKey: input.eventKey ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
      emailSent: false,
    });

    notificationsCreated += 1;

    const emailEnabled =
      input.sendEmail !== false &&
      (preferences?.email_notifications ??
        DEFAULT_USER_SETTINGS.emailNotifications);

    const recipientEmail =
      recipient.email?.trim() || authEmailMap.get(recipient.userId) || "";

    if (!emailEnabled || !recipientEmail) {
      emailSkipped += 1;
      continue;
    }

    const html = buildAlertEmailHtml({
      recipientName: recipient.name ?? null,
      titulo: input.titulo,
      mensagem: input.mensagem,
      href: input.href ?? null,
    });

    const emailResult = await sendAlertEmail({
      to: recipientEmail,
      subject: input.emailSubject?.trim() || input.titulo,
      html,
    });

    if (emailResult.ok) {
      emailsSent += 1;
    } else {
      emailSkipped += 1;
      console.error("Falha ao enviar e-mail de alerta:", emailResult.error);
    }
  }

  return {
    notificationsCreated,
    emailsSent,
    emailSkipped,
  };
}