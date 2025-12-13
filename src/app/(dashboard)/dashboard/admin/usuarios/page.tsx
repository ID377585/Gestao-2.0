"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Interfaces
interface Usuario {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  ativo: boolean;
  cargoId?: number;
  cargoNome?: string;
  createdAt: string;
  lastLogin?: string;
}

interface Cargo {
  id: number;
  nome: string;
  descricao: string;
  podeEditarInsumos: boolean;
}



// Dados de exemplo
const usuariosExemplo: Usuario[] = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@gestao2.com",
    role: "admin",
    ativo: true,
    cargoId: 8,
    cargoNome: "Gestor",
    createdAt: "2024-01-01T00:00:00",
    lastLogin: "2024-01-15T10:30:00"
  },
  {
    id: "2",
    name: "João Silva",
    email: "joao@gestao2.com",
    role: "user",
    ativo: true,
    cargoId: 1,
    cargoNome: "Chefe de Cozinha",
    createdAt: "2024-01-05T00:00:00",
    lastLogin: "2024-01-15T08:15:00"
  },
  {
    id: "3",
    name: "Maria Santos",
    email: "maria@gestao2.com",
    role: "user",
    ativo: true,
    cargoId: 3,
    cargoNome: "Confeiteira",
    createdAt: "2024-01-08T00:00:00",
    lastLogin: "2024-01-14T16:45:00"
  },
  {
    id: "4",
    name: "Pedro Costa",
    email: "pedro@gestao2.com",
    role: "user",
    ativo: false,
    cargoId: 4,
    cargoNome: "Padeiro",
    createdAt: "2024-01-10T00:00:00",
    lastLogin: "2024-01-12T14:20:00"
  }
];

const cargosExemplo: Cargo[] = [
  { id: 1, nome: "Chefe de Cozinha", descricao: "Responsável pela cozinha", podeEditarInsumos: true },
  { id: 2, nome: "Chefe de Produção", descricao: "Responsável pela produção", podeEditarInsumos: true },
  { id: 3, nome: "Confeiteira", descricao: "Especialista em confeitaria", podeEditarInsumos: true },
  { id: 4, nome: "Padeiro", descricao: "Especialista em panificação", podeEditarInsumos: true },
  { id: 5, nome: "Masseiro", descricao: "Especialista em massas", podeEditarInsumos: true },
  { id: 6, nome: "Auxiliar de Cozinha", descricao: "Auxiliar geral", podeEditarInsumos: false },
  { id: 7, nome: "Entregador", descricao: "Responsável por entregas", podeEditarInsumos: false },
  { id: 8, nome: "Gestor", descricao: "Gestor geral", podeEditarInsumos: true }
];

const modulosDisponiveis = [
  { key: "pedidos", nome: "Pedidos", descricao: "Kanban de pedidos" },
  { key: "producao", nome: "Produção", descricao: "KDS - Monitor de Cozinha" },
  { key: "estoque", nome: "Estoque", descricao: "Controle de estoque" },
  { key: "inventario", nome: "Inventário", descricao: "Sistema de inventário" },
  { key: "fichas_tecnicas", nome: "Fichas Técnicas", descricao: "Receitas e custos" },
  { key: "etiquetas", nome: "Etiquetas", descricao: "Impressão térmica" },
  { key: "compras", nome: "Compras", descricao: "Import/Export dados" },
  { key: "produtividade", nome: "Produtividade", descricao: "Ranking de colaboradores" },
  { key: "admin", nome: "Administração", descricao: "Gestão de usuários" },
  { key: "insumos", nome: "Insumos", descricao: "Cadastro de produtos" }
];

export default function UsuariosPage() {
  const [usuarios] = useState(usuariosExemplo);
  const [cargos] = useState(cargosExemplo);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [showNovoUsuario, setShowNovoUsuario] = useState(false);
  const [showPermissoes, setShowPermissoes] = useState(false);

  // Estados do formulário
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "user" as "admin" | "user",
    cargoId: "",
    ativo: true
  });

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSalvarUsuario = () => {
    // TODO: Implementar criação de usuário
    console.log("Criar usuário:", formData);
    setShowNovoUsuario(false);
    setFormData({
      name: "",
      email: "",
      role: "user",
      cargoId: "",
      ativo: true
    });
  };

  const handleToggleStatus = (userId: string) => {
    // TODO: Implementar toggle de status
    console.log("Toggle status usuário:", userId);
  };

  const handleResetPassword = (userId: string) => {
    // TODO: Implementar reset de senha
    console.log("Reset senha usuário:", userId);
    alert("Email de reset de senha enviado!");
  };

  const getRoleBadge = (role: string) => {
    return role === "admin" 
      ? <Badge className="bg-purple-500 text-white">Administrador</Badge>
      : <Badge variant="secondary">Usuário</Badge>;
  };

  const getStatusBadge = (ativo: boolean) => {
    return ativo 
      ? <Badge className="bg-green-500 text-white">Ativo</Badge>
      : <Badge className="bg-red-500 text-white">Inativo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
          <p className="text-gray-600">Administração de usuários, cargos e permissões</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📊</span>
            Relatório de Acesso
          </Button>
          <Button onClick={() => setShowNovoUsuario(true)}>
            <span className="mr-2">👤</span>
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuarios.length}</div>
            <p className="text-xs text-muted-foreground">
              Usuários cadastrados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {usuarios.filter(u => u.ativo).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {((usuarios.filter(u => u.ativo).length / usuarios.length) * 100).toFixed(0)}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <span className="text-2xl">👑</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {usuarios.filter(u => u.role === "admin").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Com acesso total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cargos</CardTitle>
            <span className="text-2xl">🏷️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cargos.length}</div>
            <p className="text-xs text-muted-foreground">
              Cargos disponíveis
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="usuarios">👥 Usuários</TabsTrigger>
          <TabsTrigger value="cargos">🏷️ Cargos</TabsTrigger>
          <TabsTrigger value="permissoes">🔐 Permissões</TabsTrigger>
        </TabsList>

        {/* Tab Usuários */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Usuários</CardTitle>
              <CardDescription>
                Gerencie todos os usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">{usuario.name}</TableCell>
                      <TableCell>{usuario.email}</TableCell>
                      <TableCell>{usuario.cargoNome || "-"}</TableCell>
                      <TableCell>{getRoleBadge(usuario.role)}</TableCell>
                      <TableCell>{getStatusBadge(usuario.ativo)}</TableCell>
                      <TableCell>
                        {usuario.lastLogin ? formatDateTime(usuario.lastLogin) : "Nunca"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setUsuarioSelecionado(usuario);
                              setShowPermissoes(true);
                            }}
                          >
                            🔐
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleToggleStatus(usuario.id)}
                          >
                            {usuario.ativo ? "⏸️" : "▶️"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleResetPassword(usuario.id)}
                          >
                            🔑
                          </Button>
                          <Button size="sm" variant="outline">
                            ✏️
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Cargos */}
        <TabsContent value="cargos">
          <Card>
            <CardHeader>
              <CardTitle>Cargos e Funções</CardTitle>
              <CardDescription>
                Configure os cargos disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pode Editar Insumos</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargos.map((cargo) => (
                    <TableRow key={cargo.id}>
                      <TableCell className="font-medium">{cargo.nome}</TableCell>
                      <TableCell>{cargo.descricao}</TableCell>
                      <TableCell>
                        {cargo.podeEditarInsumos ? (
                          <Badge className="bg-green-500 text-white">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {usuarios.filter(u => u.cargoId === cargo.id).length}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline">
                            ✏️
                          </Button>
                          <Button size="sm" variant="outline">
                            👥
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Permissões */}
        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle>Matriz de Permissões</CardTitle>
              <CardDescription>
                Configure permissões por módulo para cada usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 font-medium text-sm border-b pb-2">
                  <div>Módulo</div>
                  <div>Descrição</div>
                  <div>Visualizar</div>
                  <div>Editar</div>
                </div>
                
                {modulosDisponiveis.map((modulo) => (
                  <div key={modulo.key} className="grid grid-cols-4 gap-4 items-center py-2 border-b">
                    <div className="font-medium">{modulo.nome}</div>
                    <div className="text-sm text-gray-600">{modulo.descricao}</div>
                    <div>
                      <Switch defaultChecked />
                    </div>
                    <div>
                      <Switch />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Selecione um usuário na aba "Usuários" para configurar suas permissões específicas.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Novo Usuário */}
      {showNovoUsuario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Novo Usuário</h3>
              <Button variant="ghost" onClick={() => setShowNovoUsuario(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Nome do usuário"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="usuario@empresa.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cargo</Label>
                  <Select value={formData.cargoId} onValueChange={(value) => handleInputChange("cargoId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.id.toString()}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível de Acesso</Label>
                  <Select value={formData.role} onValueChange={(value: "admin" | "user") => handleInputChange("role", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.ativo}
                  onCheckedChange={(checked) => handleInputChange("ativo", checked)}
                />
                <Label>Usuário ativo</Label>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Senha temporária:</strong> Será enviada por email para o usuário.
                  O usuário deverá alterar a senha no primeiro login.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowNovoUsuario(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSalvarUsuario} disabled={!formData.name || !formData.email}>
                  <span className="mr-2">👤</span>
                  Criar Usuário
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissões do Usuário */}
      {showPermissoes && usuarioSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                Permissões - {usuarioSelecionado.name}
              </h3>
              <Button variant="ghost" onClick={() => setShowPermissoes(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Email:</strong> {usuarioSelecionado.email}</p>
                    <p><strong>Cargo:</strong> {usuarioSelecionado.cargoNome}</p>
                  </div>
                  <div>
                    <p><strong>Role:</strong> {usuarioSelecionado.role}</p>
                    <p><strong>Status:</strong> {usuarioSelecionado.ativo ? "Ativo" : "Inativo"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 font-medium text-sm border-b pb-2">
                  <div>Módulo</div>
                  <div>Descrição</div>
                  <div>Visualizar</div>
                  <div>Editar</div>
                </div>
                
                {modulosDisponiveis.map((modulo) => (
                  <div key={modulo.key} className="grid grid-cols-4 gap-4 items-center py-2 border-b">
                    <div className="font-medium">{modulo.nome}</div>
                    <div className="text-sm text-gray-600">{modulo.descricao}</div>
                    <div>
                      <Switch defaultChecked={usuarioSelecionado.role === "admin"} />
                    </div>
                    <div>
                      <Switch defaultChecked={usuarioSelecionado.role === "admin"} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowPermissoes(false)}>
                  Cancelar
                </Button>
                <Button>
                  <span className="mr-2">💾</span>
                  Salvar Permissões
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}