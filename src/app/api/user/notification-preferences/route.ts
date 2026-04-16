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
    darkMode: normalizeBoolean(input?.darkMode, DEFAULT_USER_SETTINGS.darkMode),
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

    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("email_notifications, browser_notifications, dark_mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar preferências de notificação:", error);
      return NextResponse.json(
        { error: "Erro ao carregar preferências." },
        { status: 500 }
      );
    }

    const settings = normalizeSettings({
      emailNotifications: data?.email_notifications,
      browserNotifications: data?.browser_notifications,
      darkMode: data?.dark_mode,
    });

    return NextResponse.json(settings, { status: 200 });
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

    const payload = {
      user_id: user.id,
      email_notifications: settings.emailNotifications,
      browser_notifications: settings.browserNotifications,
      dark_mode: settings.darkMode,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_notification_preferences")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("Erro ao salvar preferências de notificação:", error);
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