"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  applyDarkMode,
  fetchUserSettingsFromApi,
  getUserSettings,
  persistUserSettingsToApi,
  type UserSettings,
} from "@/lib/user-settings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: true,
  browserNotifications: true,
  soundNotifications: true,
  darkMode: false,
};

export function SettingsModal({
  open,
  onClose,
  onSettingsChange,
}: SettingsModalProps) {
  const { setTheme, resolvedTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof UserSettings | null>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    void (async () => {
      try {
        setLoading(true);

        const localSettings = getUserSettings();

        if (!mounted) return;

        setSettings({
          ...localSettings,
          darkMode: resolvedTheme === "dark" ? true : localSettings.darkMode,
        });

        const remoteSettings = await fetchUserSettingsFromApi();

        if (!mounted) return;

        setSettings({
          ...remoteSettings,
          darkMode: resolvedTheme === "dark" ? true : remoteSettings.darkMode,
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open, resolvedTheme]);

  const updateSettings = async (
    key: keyof UserSettings,
    value: boolean
  ) => {
    let next: UserSettings = {
      ...settings,
      [key]: value,
    };

    if (key === "browserNotifications" && value) {
      if (typeof window !== "undefined" && "Notification" in window) {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          next = {
            ...next,
            browserNotifications: false,
          };
        }
      } else {
        next = {
          ...next,
          browserNotifications: false,
        };
      }
    }

    if (key === "soundNotifications" && value && typeof window !== "undefined") {
      // Prime the browser audio permission with a silent, short user-triggered audio context.
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

      if (AudioContextClass) {
        try {
          const context = new AudioContextClass();
          const gain = context.createGain();
          gain.gain.value = 0;
          gain.connect(context.destination);
          await context.close();
        } catch {
          // Audio can still be blocked by the browser until the next direct user interaction.
        }
      }
    }

    if (key === "darkMode") {
      applyDarkMode(next.darkMode);
      setTheme(next.darkMode ? "dark" : "light");
    }

    setSettings(next);
    onSettingsChange?.(next);

    try {
      setSavingKey(key);
      const persisted = await persistUserSettingsToApi(next);
      setSettings(persisted);
      onSettingsChange?.(persisted);

      if (key === "darkMode") {
        setTheme(persisted.darkMode ? "dark" : "light");
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
    } finally {
      setSavingKey(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Configurações
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mb-4 rounded-md bg-slate-50 p-3 text-xs text-muted-foreground dark:bg-slate-800/60">
          {loading
            ? "Carregando configurações..."
            : "As alterações são salvas automaticamente para este usuário."}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Notificações por email
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Receber alertas importantes por email
              </div>
            </div>
            <Switch
              checked={settings.emailNotifications}
              disabled={loading || savingKey === "emailNotifications"}
              onCheckedChange={(checked) =>
                void updateSettings("emailNotifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Notificações no navegador
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Receber alertas no navegador em tempo real
              </div>
            </div>
            <Switch
              checked={settings.browserNotifications}
              disabled={loading || savingKey === "browserNotifications"}
              onCheckedChange={(checked) =>
                void updateSettings("browserNotifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Som de alerta
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Tocar um aviso sonoro quando chegar uma notificação nova
              </div>
            </div>
            <Switch
              checked={settings.soundNotifications}
              disabled={loading || savingKey === "soundNotifications"}
              onCheckedChange={(checked) =>
                void updateSettings("soundNotifications", checked)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Tema escuro
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Ativar modo escuro
              </div>
            </div>
            <Switch
              checked={settings.darkMode}
              disabled={loading || savingKey === "darkMode"}
              onCheckedChange={(checked) =>
                void updateSettings("darkMode", checked)
              }
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Concluir</Button>
        </div>
      </div>
    </div>
  );
}
