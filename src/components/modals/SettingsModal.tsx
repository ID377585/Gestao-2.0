"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  applyDarkMode,
  getUserSettings,
  saveUserSettings,
  type UserSettings,
} from "@/lib/user-settings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: UserSettings) => void;
}

export function SettingsModal({
  open,
  onClose,
  onSettingsChange,
}: SettingsModalProps) {
  const { setTheme, resolvedTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings>({
    emailNotifications: true,
    browserNotifications: true,
    darkMode: false,
  });

  useEffect(() => {
    if (!open) return;

    const saved = getUserSettings();

    setSettings({
      ...saved,
      darkMode:
        resolvedTheme === "dark" ? true : saved.darkMode,
    });
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

    if (key === "darkMode") {
      applyDarkMode(next.darkMode);
      setTheme(next.darkMode ? "dark" : "light");
    }

    setSettings(next);
    saveUserSettings(next);
    onSettingsChange?.(next);
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
              onCheckedChange={(checked) =>
                updateSettings("emailNotifications", checked)
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
              onCheckedChange={(checked) =>
                updateSettings("browserNotifications", checked)
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
              onCheckedChange={(checked) =>
                updateSettings("darkMode", checked)
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