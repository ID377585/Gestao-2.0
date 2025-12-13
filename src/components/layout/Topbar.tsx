"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Interface para notificações
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
  const [user] = useState({
    name: "Admin User",
    email: "admin@gestao2.com",
    role: "admin",
    avatar: "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/95215156-4b22-4f5b-abd9-f1893fb3cc73.png"
  });

  // Estados para modais
  const [showNotificacoes, setShowNotificacoes] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [showConfiguracoes, setShowConfiguracoes] = useState(false);
  const [showAjuda, setShowAjuda] = useState(false);

  // Notificações de exemplo
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([
    {
      id: 1,
      titulo: "Estoque Crítico",
      mensagem: "Ovos estão com estoque crítico (45 unidades). Reposição necessária.",
      tipo: "warning",
      lida: false,
      dataHora: "2024-01-15T10:30:00"
    },
    {
      id: 2,
      titulo: "Pedido Concluído",
      mensagem: "Pedido #2 para Padaria São João foi entregue com sucesso.",
      tipo: "success",
      lida: false,
      dataHora: "2024-01-15T09:15:00"
    },
    {
      id: 3,
      titulo: "Novo Usuário",
      mensagem: "Carlos Mendes foi adicionado ao sistema como Auxiliar de Cozinha.",
      tipo: "info",
      lida: true,
      dataHora: "2024-01-15T08:45:00"
    }
  ]);

  // Estados do perfil
  const [perfilData, setPerfilData] = useState({
    name: user.name,
    email: user.email,
    telefone: "(11) 99999-9999",
    cargo: "Administrador do Sistema"
  });

  // Estados das configurações
  const [configuracoes, setConfiguracoes] = useState({
    notificacoesEmail: true,
    notificacoesPush: true,
    temaEscuro: false,
    idiomaInterface: "pt-BR",
    fusoHorario: "America/Sao_Paulo"
  });

  const handleLogout = () => {
    // TODO: Implementar logout com Supabase
    console.log("Logout");
    window.location.href = "/login";
  };

  const marcarNotificacaoLida = (id: number) => {
    setNotificacoes(prev => prev.map(n => 
      n.id === id ? { ...n, lida: true } : n
    ));
  };

  const marcarTodasLidas = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const formatarDataHora = (dataHora: string) => {
    return new Date(dataHora).toLocaleString('pt-BR');
  };

  const getIconeNotificacao = (tipo: string) => {
    switch (tipo) {
      case "warning": return "⚠️";
      case "success": return "✅";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  const getCorNotificacao = (tipo: string) => {
    switch (tipo) {
      case "warning": return "border-l-yellow-500 bg-yellow-50";
      case "success": return "border-l-green-500 bg-green-50";
      case "error": return "border-l-red-500 bg-red-50";
      default: return "border-l-blue-500 bg-blue-50";
    }
  };

  const notificacaoNaoLidas = notificacoes.filter(n => !n.lida).length;

  const handlePerfilChange = (field: string, value: string) => {
    setPerfilData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfiguracaoChange = (field: string, value: boolean | string) => {
    setConfiguracoes(prev => ({ ...prev, [field]: value }));
  };

  const salvarPerfil = () => {
    // TODO: Implementar salvamento no Supabase
    console.log("Salvar perfil:", perfilData);
    alert("Perfil atualizado com sucesso!");
    setShowPerfil(false);
  };

  const salvarConfiguracoes = () => {
    // TODO: Implementar salvamento no Supabase
    console.log("Salvar configurações:", configuracoes);
    alert("Configurações salvas com sucesso!");
    setShowConfiguracoes(false);
  };

  return (
    <header className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side - Breadcrumb or Title */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Dashboard
          </h1>
        </div>

        {/* Right side - User menu and notifications */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <span className="text-lg">🔔</span>
                {notificacaoNaoLidas > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {notificacaoNaoLidas}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80" align="end">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span>Notificações</span>
                {notificacaoNaoLidas > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={marcarTodasLidas}
                    className="text-xs"
                  >
                    Marcar todas como lidas
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <div className="max-h-96 overflow-y-auto">
                {notificacoes.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <span className="text-2xl block mb-2">🔕</span>
                    Nenhuma notificação
                  </div>
                ) : (
                  notificacoes.map((notificacao) => (
                    <div
                      key={notificacao.id}
                      className={`p-3 border-l-4 ${getCorNotificacao(notificacao.tipo)} ${!notificacao.lida ? 'bg-opacity-100' : 'bg-opacity-50'} cursor-pointer hover:bg-opacity-75`}
                      onClick={() => marcarNotificacaoLida(notificacao.id)}
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">{getIconeNotificacao(notificacao.tipo)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${!notificacao.lida ? 'text-gray-900' : 'text-gray-600'}`}>
                              {notificacao.titulo}
                            </p>
                            {!notificacao.lida && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {notificacao.mensagem}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatarDataHora(notificacao.dataHora)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowNotificacoes(true)}
                >
                  Ver todas as notificações
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  <Badge variant="secondary" className="w-fit mt-1">
                    {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowPerfil(true)}>
                <span className="mr-2">👤</span>
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowConfiguracoes(true)}>
                <span className="mr-2">⚙️</span>
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAjuda(true)}>
                <span className="mr-2">❓</span>
                Ajuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <span className="mr-2">🚪</span>
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modal de Notificações Completo */}
      {showNotificacoes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Todas as Notificações</h3>
              <Button variant="ghost" onClick={() => setShowNotificacoes(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              {notificacoes.map((notificacao) => (
                <div
                  key={notificacao.id}
                  className={`p-4 border-l-4 ${getCorNotificacao(notificacao.tipo)} rounded-r-lg ${!notificacao.lida ? 'bg-opacity-100' : 'bg-opacity-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <span className="text-xl">{getIconeNotificacao(notificacao.tipo)}</span>
                      <div>
                        <h4 className={`font-medium ${!notificacao.lida ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notificacao.titulo}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notificacao.mensagem}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatarDataHora(notificacao.dataHora)}
                        </p>
                      </div>
                    </div>
                    {!notificacao.lida && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => marcarNotificacaoLida(notificacao.id)}
                      >
                        Marcar como lida
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={() => setShowNotificacoes(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perfil */}
      {showPerfil && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Meu Perfil</h3>
              <Button variant="ghost" onClick={() => setShowPerfil(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-600 to-green-600 text-white text-xl">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-lg font-semibold">{user.name}</h4>
                  <p className="text-gray-600">{perfilData.cargo}</p>
                  <Badge variant="secondary" className="mt-1">
                    {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </Badge>
                </div>
              </div>

              {/* Dados do Perfil */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input 
                    id="nome"
                    value={perfilData.name}
                    onChange={(e) => handlePerfilChange("name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email"
                    type="email"
                    value={perfilData.email}
                    onChange={(e) => handlePerfilChange("email", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input 
                    id="telefone"
                    value={perfilData.telefone}
                    onChange={(e) => handlePerfilChange("telefone", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input 
                    id="cargo"
                    value={perfilData.cargo}
                    disabled
                  />
                </div>
              </div>

              {/* Alterar Senha */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Alterar Senha</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="senhaAtual">Senha Atual</Label>
                    <Input id="senhaAtual" type="password" />
                  </div>
                  <div>
                    <Label htmlFor="novaSenha">Nova Senha</Label>
                    <Input id="novaSenha" type="password" />
                  </div>
                </div>
                <Button size="sm" className="mt-2">
                  Alterar Senha
                </Button>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowPerfil(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvarPerfil}>
                  <span className="mr-2">💾</span>
                  Salvar Perfil
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configurações */}
      {showConfiguracoes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Configurações</h3>
              <Button variant="ghost" onClick={() => setShowConfiguracoes(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Notificações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Notificações</CardTitle>
                  <CardDescription>
                    Configure como você deseja receber notificações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificações por Email</Label>
                      <p className="text-sm text-gray-600">Receber notificações importantes por email</p>
                    </div>
                    <Switch 
                      checked={configuracoes.notificacoesEmail}
                      onCheckedChange={(checked) => handleConfiguracaoChange("notificacoesEmail", checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificações Push</Label>
                      <p className="text-sm text-gray-600">Receber notificações no navegador</p>
                    </div>
                    <Switch 
                      checked={configuracoes.notificacoesPush}
                      onCheckedChange={(checked) => handleConfiguracaoChange("notificacoesPush", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Aparência */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Aparência</CardTitle>
                  <CardDescription>
                    Personalize a aparência do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Tema Escuro</Label>
                      <p className="text-sm text-gray-600">Usar tema escuro no sistema</p>
                    </div>
                    <Switch 
                      checked={configuracoes.temaEscuro}
                      onCheckedChange={(checked) => handleConfiguracaoChange("temaEscuro", checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Localização */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Localização</CardTitle>
                  <CardDescription>
                    Configure idioma e fuso horário
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Idioma da Interface</Label>
                    <Input value="Português (Brasil)" disabled />
                  </div>
                  <div>
                    <Label>Fuso Horário</Label>
                    <Input value="America/São_Paulo (GMT-3)" disabled />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowConfiguracoes(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvarConfiguracoes}>
                  <span className="mr-2">💾</span>
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ajuda */}
      {showAjuda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Central de Ajuda</h3>
              <Button variant="ghost" onClick={() => setShowAjuda(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Guia Rápido */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="mr-2">🚀</span>
                    Guia Rápido
                  </CardTitle>
                  <CardDescription>
                    Primeiros passos no Sistema Gestão 2.0
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold">1. Criar um Pedido</h4>
                      <p className="text-sm text-gray-600">
                        Vá em Pedidos → Gerar Pedido → Selecione estabelecimento → Adicione produtos
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">2. Acompanhar Produção</h4>
                      <p className="text-sm text-gray-600">
                        Use o KDS em Produção para controlar o preparo dos itens
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">3. Controlar Estoque</h4>
                      <p className="text-sm text-gray-600">
                        Monitore o estoque em tempo real e faça inventários periódicos
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold">4. Gerar Etiquetas</h4>
                      <p className="text-sm text-gray-600">
                        Crie etiquetas de manipulação e revalidação para impressão térmica
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Funcionalidades */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="mr-2">📋</span>
                    Funcionalidades Principais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">📋 Gestão de Pedidos</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Kanban visual com 6 status</li>
                        <li>• Cálculo automático de custos</li>
                        <li>• Controle de prazos de entrega</li>
                        <li>• Atualizações em tempo real</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">👨‍🍳 KDS - Monitor de Cozinha</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Monitor em tempo real</li>
                        <li>• Delegação de tarefas</li>
                        <li>• Controle de tempo</li>
                        <li>• Registro de produtividade</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">📦 Controle de Estoque</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Estoque em tempo real</li>
                        <li>• Alertas de estoque mínimo</li>
                        <li>• Sistema de inventário</li>
                        <li>• Controle de perdas</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">📊 Produtividade</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Ranking de colaboradores</li>
                        <li>• Métricas por período</li>
                        <li>• Relatórios detalhados</li>
                        <li>• Análise de performance</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Atalhos de Teclado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="mr-2">⌨️</span>
                    Atalhos de Teclado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + N</kbd> Novo Pedido</p>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + E</kbd> Estoque</p>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + P</kbd> Produção</p>
                    </div>
                    <div>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + R</kbd> Produtividade</p>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + F</kbd> Fichas Técnicas</p>
                      <p><kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl + L</kbd> Etiquetas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Suporte */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="mr-2">📞</span>
                    Suporte e Contato
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Contato Técnico</h4>
                      <p className="text-sm text-gray-600">Email: suporte@gestao2.com</p>
                      <p className="text-sm text-gray-600">Telefone: (11) 9999-9999</p>
                      <p className="text-sm text-gray-600">Horário: 8h às 18h</p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Documentação</h4>
                      <Button variant="outline" size="sm" className="mr-2 mb-2">
                        📖 Manual do Usuário
                      </Button>
                      <Button variant="outline" size="sm" className="mb-2">
                        🎥 Vídeos Tutoriais
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={() => setShowAjuda(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}