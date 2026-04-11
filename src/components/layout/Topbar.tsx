"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  HelpCircle,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import NotificationsModal from "@/components/modals/NotificationsModal";
import { ProfileModal } from "@/components/modals/ProfileModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { HelpModal } from "@/components/modals/HelpModal";

import { SidebarMobile } from "@/components/layout/SidebarMobile";

import { clearSession, getUser, type AppUser } from "@/lib/auth/session";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/notifications";
import {
  applyDarkMode,
  getUserSettings,
  type UserSettings,
} from "@/lib/user-settings";

interface TopbarProps {
  className?: string;
}

type SessionUserExtended = AppUser & {
  id?: string;
  uid?: string;
};

function formatDate(value?: AppNotification["createdAt"]) {
  if (!value) return "Agora";

  try {
    const date =
      typeof (value as any)?.toDate === "function"
        ? (value as any).toDate()
        : new Date(value as any);

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Agora";
  }
}

export function Topbar({ className }: TopbarProps) {
  const [user, setUser] = useState<SessionUserExtended | null>(null);

  const [showPerfil, setShowPerfil] = useState(false);
  const [showConfiguracoes, setShowConfiguracoes] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);
  const [showNotificacoesModal, setShowNotificacoesModal] = useState(false);

  const [notificacoes, setNotificacoes] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<UserSettings>(getUserSettings());

  const previousIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const currentUser = getUser() as SessionUserExtended | null;
    setUser(currentUser);

    const savedSettings = getUserSettings();
    setSettings(savedSettings);
    applyDarkMode(savedSettings.darkMode);
  }, []);

  const userNotificationId = useMemo(() => {
    if (!user) return null;
    return user.id || user.uid || user.email || null;
  }, [user]);

  useEffect(() => {
    if (!userNotificationId) return;

    const unsubscribe = subscribeToNotifications(userNotificationId, (items) => {
      setNotificacoes(items);

      const currentIds = items.map((item) => item.id);
      const previousIds = previousIdsRef.current;

      const newNotifications = items.filter(
        (item) => !previousIds.includes(item.id)
      );

      if (
        settings.browserNotifications &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        newNotifications.forEach((item) => {
          new Notification(item.titulo, {
            body: item.mensagem,
          });
        });
      }

      previousIdsRef.current = currentIds;
    });

    return () => unsubscribe();
  }, [userNotificationId, settings.browserNotifications]);

  const notificacoesNaoLidas = notificacoes.filter((n) => !n.lida).length;

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(notificacoes);
    } catch (error) {
      console.error("Erro ao marcar notificações como lidas:", error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  };

  const handleLogout = () => {
    clearSession();
    window.location.assign("/login");
  };

  const dropdownBaseClasses =
    "bg-white text-gray-900 border border-gray-200 shadow-lg rounded-md";

  return (
    <>
      <header className={`bg-white border-b border-gray-200 ${className ?? ""}`}>
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <SidebarMobile />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5 text-gray-700" />
                  {notificacoesNaoLidas > 0 && (
                    <span className="absolute -top-1 -right-1">
                      <Badge className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">
                        {notificacoesNaoLidas}
                      </Badge>
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={`w-80 ${dropdownBaseClasses}`}
              >
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Notificações
                  </span>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={handleMarkAllAsRead}
                    disabled={notificacoesNaoLidas === 0}
                  >
                    Marcar todas
                  </Button>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {notificacoes.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-600">
                    Nenhuma notificação
                  </div>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    {notificacoes.slice(0, 5).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex cursor-pointer flex-col items-start gap-1 py-3 focus:bg-gray-50"
                        onSelect={() => {
                          if (!n.lida) {
                            handleMarkAsRead(n.id);
                          }
                        }}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900">
                            {n.titulo}
                          </span>
                          {!n.lida && (
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <span className="text-xs text-gray-700">{n.mensagem}</span>
                        <span className="text-[11px] text-gray-500">
                          {formatDate(n.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}

                <DropdownMenuSeparator />

                <div className="p-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowNotificacoesModal(true)}
                  >
                    Ver todas
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300"
                  aria-label="Menu do usuário"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={user?.avatar}
                      alt={user?.name ?? "Usuário"}
                    />
                    <AvatarFallback>
                      {(user?.name ?? "U")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={`w-64 ${dropdownBaseClasses}`}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {user?.name ?? "Usuário"}
                    </span>
                    <span className="text-xs text-gray-600">
                      {user?.email ?? ""}
                    </span>
                    <Badge variant="secondary" className="mt-1 w-fit">
                      {(user?.role ?? "user") === "admin"
                        ? "Administrador"
                        : "Usuário"}
                    </Badge>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={() => setShowPerfil(true)}
                  className="focus:bg-gray-50"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setShowConfiguracoes(true)}
                  className="focus:bg-gray-50"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setShowAjuda(true)}
                  className="focus:bg-gray-50"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ajuda
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="text-red-600 focus:bg-gray-50 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <NotificationsModal
        open={showNotificacoesModal}
        onClose={() => setShowNotificacoesModal(false)}
        notifications={notificacoes}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      <ProfileModal
        open={showPerfil}
        onClose={() => setShowPerfil(false)}
        user={{
          name: user?.name ?? "Usuário",
          email: user?.email ?? "",
          role: user?.role,
        }}
      />

      <SettingsModal
        open={showConfiguracoes}
        onClose={() => setShowConfiguracoes(false)}
        onSettingsChange={(nextSettings) => setSettings(nextSettings)}
      />

      <HelpModal open={showAjuda} onClose={() => setShowAjuda(false)} />
    </>
  );
}