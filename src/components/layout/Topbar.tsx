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

  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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

  const openAfterDropdownClose = (openModal: () => void) => {
    setUserMenuOpen(false);
    setNotificationsMenuOpen(false);

    setTimeout(() => {
      openModal();
    }, 80);
  };

  const handleOpenPerfil = () => {
    openAfterDropdownClose(() => setShowPerfil(true));
  };

  const handleOpenConfiguracoes = () => {
    openAfterDropdownClose(() => setShowConfiguracoes(true));
  };

  const handleOpenAjuda = () => {
    openAfterDropdownClose(() => setShowAjuda(true));
  };

  const handleOpenTodasNotificacoes = () => {
    openAfterDropdownClose(() => setShowNotificacoesModal(true));
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    clearSession();
    window.location.assign("/login");
  };

  const dropdownBaseClasses =
    "z-50 rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <>
      <header
        className={`border-b border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${className ?? ""}`}
      >
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <SidebarMobile />
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu
              open={notificationsMenuOpen}
              onOpenChange={setNotificationsMenuOpen}
              modal={false}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-600"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  {notificacoesNaoLidas > 0 && (
                    <span className="absolute -right-1 -top-1">
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
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    Notificações
                  </span>

                  <Button
                    type="button"
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
                  <div className="px-3 py-6 text-center text-sm text-gray-600 dark:text-slate-400">
                    Nenhuma notificação
                  </div>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    {notificacoes.slice(0, 5).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex cursor-pointer flex-col items-start gap-1 py-3 focus:bg-gray-50 dark:focus:bg-slate-800"
                        onSelect={(event) => {
                          event.preventDefault();
                          if (!n.lida) {
                            handleMarkAsRead(n.id);
                          }
                        }}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {n.titulo}
                          </span>
                          {!n.lida && (
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-slate-300">
                          {n.mensagem}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-slate-400">
                          {formatDate(n.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}

                <DropdownMenuSeparator />

                <div className="p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleOpenTodasNotificacoes}
                  >
                    Ver todas
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu
              open={userMenuOpen}
              onOpenChange={setUserMenuOpen}
              modal={false}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-600"
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
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {user?.name ?? "Usuário"}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">
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
                  onSelect={(event) => {
                    event.preventDefault();
                    handleOpenPerfil();
                  }}
                  className="focus:bg-gray-50 dark:focus:bg-slate-800"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    handleOpenConfiguracoes();
                  }}
                  className="focus:bg-gray-50 dark:focus:bg-slate-800"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    handleOpenAjuda();
                  }}
                  className="focus:bg-gray-50 dark:focus:bg-slate-800"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ajuda
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    handleLogout();
                  }}
                  className="text-red-600 focus:bg-gray-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-slate-800 dark:focus:text-red-400"
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