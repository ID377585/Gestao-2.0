import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from "@/lib/user-settings";

export const dynamic = "force-dynamic";

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSettings(input?: Partial<UserSettings> | null): UserSettings {
  return {
    emailNotifications: normalizeBoolean(
      input?.emailNotifications,
      DEFAULT_USER_SETTINGS.emailNotifications
    ),
    browserNotifications: normalizeBoolean(
      input?.browserNotifications,
      DEFAULT_USER_SETTINGS.browserNotifications
    ),
    soundNotifications: normalizeBoolean(
      input?.soundNotifications,
      DEFAULT_USER_SETTINGS.soundNotifications
    ),
    darkMode: normalizeBoolean(input?.darkMode, DEFAULT_USER_SETTINGS.darkMode),
  };
}

async function loadFromUserNotificationPreferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<Partial<UserSettings> | null> {
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("email_notifications, browser_notifications, dark_mode")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    emailNotifications: data.email_notifications,
    browserNotifications: data.browser_notifications,
    darkMode: data.dark_mode,
  };
}

async function loadFromNotificationPreferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<Partial<UserSettings> | null> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("sound_enabled, browser_push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    browserNotifications: data.browser_push_enabled,
    soundNotifications: data.sound_enabled,
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const [legacyResult, currentResult] = await Promise.allSettled([
      loadFromUserNotificationPreferences(supabase, user.id),
      loadFromNotificationPreferences(supabase, user.id),
    ]);

    if (legacyResult.status === "rejected") {
      console.warn("Preferências legadas indisponíveis:", legacyResult.reason);
    }

    if (currentResult.status === "rejected") {
      console.warn("Novo schema de preferências indisponível:", currentResult.reason);
    }

    const legacySettings =
      legacyResult.status === "fulfilled" ? legacyResult.value : null;
    const currentSettings =
      currentResult.status === "fulfilled" ? currentResult.value : null;

    return NextResponse.json(
      normalizeSettings({
        ...legacySettings,
        ...currentSettings,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Erro inesperado ao buscar preferências:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Partial<UserSettings>;
    const settings = normalizeSettings(body);
    const updatedAt = new Date().toISOString();

    const [legacyResult, currentResult] = await Promise.all([
      supabase
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: user.id,
            email_notifications: settings.emailNotifications,
            browser_notifications: settings.browserNotifications,
            dark_mode: settings.darkMode,
            updated_at: updatedAt,
          },
          { onConflict: "user_id" }
        ),
      supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            sound_enabled: settings.soundNotifications,
            critical_sound_enabled: settings.soundNotifications,
            browser_push_enabled: settings.browserNotifications,
            updated_at: updatedAt,
          },
          { onConflict: "user_id" }
        ),
    ]);

    if (legacyResult.error) {
      console.warn("Erro ao salvar preferências legadas:", legacyResult.error);
    }

    if (currentResult.error) {
      console.warn("Erro ao salvar preferências no novo schema:", currentResult.error);
    }

    if (legacyResult.error && currentResult.error) {
      return NextResponse.json(
        { error: "Erro ao salvar preferências." },
        { status: 500 }
      );
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error: any) {
    console.error("Erro inesperado ao salvar preferências:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
