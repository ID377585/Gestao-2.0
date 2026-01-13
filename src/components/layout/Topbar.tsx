// src/components/layout/topbar.tsx
"use client";

import { useEffect, useState } from "react";
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

interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: "info" | "warning" | "success" | "error";
  lida: boolean;
  dataHora: string;
}

interface TopbarProps {
  className?: string;
}

export function Topbar({ className }: TopbarProps) {
  const [user, setUser] = useState<AppUser | null>(null);

  const [showPerfil, setShowPerfil] = useState(false);
  const [showConfiguracoes, setShowConfiguracoes] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);
  const [showNotificacoesModal, setShowNotificacoesModal] = useState(false);

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([
    {
      id: 1,
      titulo: "Estoque crítico",
      mensagem: "Ovos estão com estoque crítico. Reposição necessária.",
      tipo: "warning",
      lida: false,
      dataHora: "2024-01-15T10:30:00",
    },
    {
      id: 2,
      titulo: "Pedido concluído",
      mensagem: "Pedido #102 foi entregue com sucesso.",
      tipo: "success",
      lida: false,
      dataHora: "2024-01-15T09:15:00",
    },
  ]);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
  }, []);

  const notificacoesNaoLidas = notificacoes.filter((n) => !n.lida).length;

  const marcarTodasLidas = () => {
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const handleLogout = () => {
    clearSession();
    window.location.assign("/login");
  };

  // ✅ Força visual correto (resolve “fundo incolor”)
  const dropdownBaseClasses =
    "bg-white text-gray-900 border border-gray-200 shadow-lg rounded-md";

  return (
    <>
      <header className={`bg-white border-b border-gray-200 ${className ?? ""}`}>
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          {/* Left */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* ✅ BOTÃO DO MENU MOBILE (aparece só no mobile) */}
            <SidebarMobile />
            {/* ✅ REMOVIDO: título fixo (evita aparecer "." no topo) */}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
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
                    onClick={marcarTodasLidas}
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
                    {notificacoes.map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="flex cursor-default flex-col items-start gap-1 py-3 focus:bg-gray-50"
                        onSelect={(e) => e.preventDefault()}
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

            {/* User Menu */}
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
                  onClick={() => setShowPerfil(true)}
                  className="focus:bg-gray-50"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setShowConfiguracoes(true)}
                  className="focus:bg-gray-50"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => setShowAjuda(true)}
                  className="focus:bg-gray-50"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Ajuda
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
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

      {/* Modais */}
      <NotificationsModal
        open={showNotificacoesModal}
        onClose={() => setShowNotificacoesModal(false)}
        notifications={notificacoes}
      />

      <ProfileModal
        open={showPerfil}
        onClose={() => setShowPerfil(false)}
        user={{
          name: user?.name ?? "Usuário",
          email: user?.email ?? "",
        }}
      />

      <SettingsModal
        open={showConfiguracoes}
        onClose={() => setShowConfiguracoes(false)}
      />

      <HelpModal open={showAjuda} onClose={() => setShowAjuda(false)} />
    </>
  );
}
