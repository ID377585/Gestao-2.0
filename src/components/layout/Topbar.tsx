"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  HelpCircle,
  LogOut,
  RefreshCw,
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
import { CurrentDateWeather } from "@/components/layout/CurrentDateWeather";
import {
  SubscriptionStatusBadge,
  type SubscriptionStatusBadgeData,
} from "@/components/billing/SubscriptionStatusBadge";

import { clearSession } from "@/lib/auth/session";
import {
  archiveNotification,
  archiveReadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  playNotificationSound,
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

function getPriorityLabel(priority?: AppNotification["priority"]) {
  switch (priority) {
    case "critical":
      return "Crítica";
    case "high":
      return "Alta";
    case "info":
      return "Info";
    default:
      return "Normal";
  }
}

function getPriorityClass(priority?: AppNotification["priority"]) {
  switch (priority) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function canRunNotificationChecks(role?: string | null) {
  return ["admin", "operacao", "estoque"].includes(String(role ?? ""));
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
  const [checkingNotifications, setCheckingNotifications] = useState(false);
  const [notificationCheckMessage, setNotificationCheckMessage] = useState<string | null>(null);

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

      if (previousIds.length > 0 && settings.soundNotifications && newNotifications.length > 0) {
        const hasCritical = newNotifications.some((item) => item.priority === "critical");
        playNotificationSound(hasCritical ? "critical" : newNotifications[0]?.priority ?? "normal");
      }

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
  }, [userNotificationId, settings.browserNotifications, settings.soundNotifications]);

  const notificacoesNaoLidas = notificacoes.filter((n) => !n.read).length;
  const podeVerificarAlertas = canRunNotificationChecks(user?.role);

  const handleRunNotificationChecks = async () => {
    if (!podeVerificarAlertas || checkingNotifications) return;

    try {
      setCheckingNotifications(true);
      setNotificationCheckMessage(null);

      const response = await fetch("/api/admin/notifications/run-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: unknown;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível verificar os alertas.");
      }

      setNotificationCheckMessage("Alertas verificados agora.");
    } catch (error: any) {
      console.error("Erro ao verificar alertas operacionais:", error);
      setNotificationCheckMessage(error?.message ?? "Erro ao verificar alertas.");
    } finally {
      setCheckingNotifications(false);
    }
  };

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

  const handleArchiveNotification = async (id: string) => {
    try {
      await archiveNotification(id);
    } catch (error) {
      console.error("Erro ao arquivar notificação:", error);
    }
  };

  const handleArchiveReadNotifications = async () => {
    if (!userNotificationId) return;

    try {
      await archiveReadNotifications(userNotificationId);
    } catch (error) {
      console.error("Erro ao arquivar notificações lidas:", error);
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
            <CurrentDateWeather />
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

              <DropdownMenuContent align="end" className={`w-80 ${dropdownBaseClasses}`}>
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <span>Notificações</span>
                  <Badge variant="secondary">{notificacoesNaoLidas}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-auto py-1">
                  {notificacoes.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                      Nenhuma notificação no momento.
                    </div>
                  ) : (
                    notificacoes.slice(0, 6).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal px-3 py-2"
                        onClick={() => {
                          if (n.href) {
                            void markNotificationAsRead(n.id);
                            window.location.assign(n.href);
                          }
                        }}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium text-gray-900 dark:text-slate-100">
                            {n.title}
                          </span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${getPriorityClass(n.priority)}`}>
                            {getPriorityLabel(n.priority)}
                          </span>
                        </div>
                        <span className="line-clamp-2 text-xs text-gray-500 dark:text-slate-400">
                          {n.message}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {formatDate(n.createdAt)}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                {podeVerificarAlertas ? (
                  <>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      disabled={checkingNotifications}
                      onClick={(event) => {
                        event.preventDefault();
                        void handleRunNotificationChecks();
                      }}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${checkingNotifications ? "animate-spin" : ""}`} />
                      {checkingNotifications ? "Verificando..." : "Verificar alertas agora"}
                    </DropdownMenuItem>
                    {notificationCheckMessage ? (
                      <div className="px-3 pb-2 text-xs text-gray-500 dark:text-slate-400">
                        {notificationCheckMessage}
                      </div>
                    ) : null}
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleMarkAllAsRead();
                  }}
                >
                  Marcar todas como lidas
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.preventDefault();
                    handleOpenTodasNotificacoes();
                  }}
                >
                  Ver todas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:hover:bg-slate-800 dark:focus:ring-slate-600"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar ?? undefined} alt={user?.name ?? "Usuário"} />
                    <AvatarFallback>
                      {loadingUser ? "..." : getInitials(user?.name ?? user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-64 ${dropdownBaseClasses}`}>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="line-clamp-1 text-sm font-semibold">{user?.name ?? "Usuário"}</span>
                    <span className="line-clamp-1 text-xs text-gray-500 dark:text-slate-400">{user?.email}</span>
                    <span className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                      {getRoleLabel(user?.role)}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={handleOpenPerfil}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handleOpenConfiguracoes}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handleOpenAjuda}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ajuda
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ProfileModal open={showPerfil} onClose={() => setShowPerfil(false)} user={user} />
      <SettingsModal
        open={showConfiguracoes}
        onClose={() => setShowConfiguracoes(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
      <HelpModal open={showAjuda} onClose={() => setShowAjuda(false)} />
      <NotificationsModal
        open={showNotificacoesModal}
        onClose={() => setShowNotificacoesModal(false)}
        notifications={notificacoes}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onArchive={handleArchiveNotification}
        onArchiveRead={handleArchiveReadNotifications}
      />
    </>
  );
}
