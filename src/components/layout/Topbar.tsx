"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabase";
import NotificationsModal from "@/components/modals/NotificationsModal";
import { ProfileModal } from "@/components/modals/ProfileModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { HelpModal } from "@/components/modals/HelpModal";
import { Sidebar } from "@/components/layout/Sidebar";
import { TenantSummary } from "@/components/tenant/TenantSummary";
import {
  SubscriptionStatusBadge,
  type SubscriptionStatusBadgeData,
} from "@/components/billing/SubscriptionStatusBadge";

import { clearSession } from "@/lib/auth/session";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
  type AppNotification,
} from "@/lib/notifications";
import {
  getUserSettings,
  syncUserSettingsWithServer,
  type UserSettings,
} from "@/lib/user-settings";

interface TopbarProps {
  className?: string;
}

type TopbarUser = {
  id: string;
  email: string;
  name: string;
  role?: string;
  avatar?: string | null;
  sector?: string | null;
  establishmentId?: string | null;
  establishmentName?: string | null;
  orgId?: string | null;
  unitId?: string | null;
  subscription?: SubscriptionStatusBadgeData;
  isActive?: boolean;
  lastSignInAt?: string | null;
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

function getRoleLabel(role?: string | null) {
  switch (String(role ?? "").trim()) {
    case "admin":
      return "Administrador";
    case "operacao":
      return "Operação";
    case "producao":
      return "Produção";
    case "estoque":
      return "Estoque";
    case "fiscal":
      return "Fiscal";
    case "entrega":
      return "Entrega";
    case "cliente":
      return "Cliente";
    default:
      return "Usuário";
  }
}

function getInitials(name?: string | null) {
  const safeName = String(name ?? "").trim();
  if (!safeName) return "U";

  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

export function Topbar({ className }: TopbarProps) {
  const [user, setUser] = useState<TopbarUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [showPerfil, setShowPerfil] = useState(false);
  const [showConfiguracoes, setShowConfiguracoes] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);
  const [showNotificacoesModal, setShowNotificacoesModal] = useState(false);

  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [notificacoes, setNotificacoes] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<UserSettings>(getUserSettings());

  const previousIdsRef = useRef<string[]>([]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setLoadingUser(true);

      const response = await fetch("/api/user/me", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as TopbarUser;
      setUser(data);
    } catch (error) {
      console.error("Erro ao carregar usuário do Topbar:", error);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentUser();

    void (async () => {
      const synced = await syncUserSettingsWithServer();
      setSettings(synced);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await fetchCurrentUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchCurrentUser]);

  const userNotificationId = useMemo(() => {
    if (!user) return null;
    return user.id || user.email || null;
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
        if ("Notification" in window && Notification.permission === "granted") {
          newNotifications.forEach((item) => {
            new Notification(item.title ?? "Notificação", {
              body: item.message ?? "",
            });
          });
        }
      }

      previousIdsRef.current = currentIds;
    });

    return () => unsubscribe();
  }, [userNotificationId, settings.browserNotifications]);

  const notificacoesNaoLidas = notificacoes.filter((n) => !n.read).length;

  const handleMarkAllAsRead = async () => {
    if (!userNotificationId) return;

    try {
      await markAllNotificationsAsRead(userNotificationId);
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

  const handleLogout = async () => {
    try {
      setUserMenuOpen(false);
      await supabase.auth.signOut();
    } finally {
      clearSession();
      window.location.assign("/login");
    }
  };

  const dropdownBaseClasses =
    "z-50 rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <>
      <header
        className={`border-b border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${className ?? ""}`}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-3 md:hidden">
            <Sidebar />
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
            <TenantSummary />
            <SubscriptionStatusBadge subscription={user?.subscription} />
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
                          if (!n.read) {
                            void handleMarkAsRead(n.id);
                          }

                          if (n.href) {
                            window.location.assign(n.href);
                          }
                        }}
                      >
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-slate-300">
                          {n.message}
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
                      src={user?.avatar ?? undefined}
                      alt={user?.name ?? "Usuário"}
                    />
                    <AvatarFallback>
                      {getInitials(user?.name ?? "U")}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className={`w-72 ${dropdownBaseClasses}`}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {loadingUser ? "Carregando..." : user?.name ?? "Usuário"}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">
                      {user?.email ?? ""}
                    </span>

                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="w-fit">
                        {getRoleLabel(user?.role)}
                      </Badge>

                      {user?.sector ? (
                        <Badge variant="outline" className="w-fit">
                          {user.sector}
                        </Badge>
                      ) : null}
                    </div>
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
                    void handleLogout();
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
          sector: user?.sector ?? null,
          establishmentId: user?.establishmentId ?? null,
          establishmentName: user?.establishmentName ?? null,
          lastSignInAt: user?.lastSignInAt ?? null,
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
