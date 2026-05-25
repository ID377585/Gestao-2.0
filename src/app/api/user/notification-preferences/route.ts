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

async function loadFromUserNotificationPreferences(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("email_notifications, browser_notifications, sound_notifications, dark_mode")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) return null;

  return normalizeSettings({
    emailNotifications: data.email_notifications,
    browserNotifications: data.browser_notifications,
    soundNotifications: data.sound_notifications,
    darkMode: data.dark_mode,
  });
}

async function loadFromNotificationPreferences(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string) {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("sound_enabled, browser_push_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) return null;

  return normalizeSettings({
    browserNotifications: data.browser_push_enabled,
    soundNotifications: data.sound_enabled,
  });
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

    try {
      const settings = await loadFromUserNotificationPreferences(supabase, user.id);
      if (settings) return NextResponse.json(settings, { status: 200 });
    } catch (error) {
      console.warn("Preferências legadas indisponíveis, tentando novo schema:", error);
    }

    try {
      const settings = await loadFromNotificationPreferences(supabase, user.id);
      if (settings) return NextResponse.json(settings, { status: 200 });
    } catch (error) {
      console.warn("Novo schema de preferências indisponível:", error);
    }

    return NextResponse.json(DEFAULT_USER_SETTINGS, { status: 200 });
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

    const legacyPayload = {
      user_id: user.id,
      email_notifications: settings.emailNotifications,
      browser_notifications: settings.browserNotifications,
      sound_notifications: settings.soundNotifications,
      dark_mode: settings.darkMode,
      updated_at: new Date().toISOString(),
    };

    let saved = false;

    const legacyResult = await supabase
      .from("user_notification_preferences")
      .upsert(legacyPayload, { onConflict: "user_id" });

    if (!legacyResult.error) {
      saved = true;
    } else {
      console.warn("Erro ao salvar preferências legadas, tentando novo schema:", legacyResult.error);
    }

    const currentResult = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          sound_enabled: settings.soundNotifications,
          critical_sound_enabled: settings.soundNotifications,
          browser_push_enabled: settings.browserNotifications,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (!currentResult.error) {
      saved = true;
    } else {
      console.warn("Erro ao salvar preferências no novo schema:", currentResult.error);
    }

    if (!saved) {
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
