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

// =====================
// Interfaces
// =====================
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

interface FormDataUsuario {
  name: string;
  email: string;
  role: "admin" | "user";
  cargoId: string;
  ativo: boolean;
}

// =====================
// Dados mock
// =====================
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
    lastLogin: "2024-01-15T10:30:00",
  },
];

const cargosExemplo: Cargo[] = [
  { id: 1, nome: "Chefe de Cozinha", descricao: "Responsável pela cozinha", podeEditarInsumos: true },
  { id: 8, nome: "Gestor", descricao: "Gestor geral", podeEditarInsumos: true },
];

const modulosDisponiveis = [
  { key: "pedidos", nome: "Pedidos", descricao: "Kanban de pedidos" },
  { key: "producao", nome: "Produção", descricao: "KDS - Monitor de Cozinha" },
  { key: "estoque", nome: "Estoque", descricao: "Controle de estoque" },
];

// =====================
// Componente
// =====================
export default function UsuariosPage() {
  const [usuarios] = useState<Usuario[]>(usuariosExemplo);
  const [cargos] = useState<Cargo[]>(cargosExemplo);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [showNovoUsuario, setShowNovoUsuario] = useState(false);
  const [showPermissoes, setShowPermissoes] = useState(false);

  const [formData, setFormData] = useState<FormDataUsuario>({
    name: "",
    email: "",
    role: "user",
    cargoId: "",
    ativo: true,
  });

  // ✅ CORREÇÃO AQUI (tipagem segura)
  const handleInputChange = <K extends keyof FormDataUsuario>(
    field: K,
    value: FormDataUsuario[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSalvarUsuario = () => {
    console.log("Criar usuário:", formData);
    setShowNovoUsuario(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Gestão de Usuários</h1>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {u.ativo ? (
                          <Badge className="bg-green-500 text-white">Ativo</Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white">Inativo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle>Permissões</CardTitle>
              <CardDescription>
                <strong>Nota:</strong> Selecione um usuário na aba Usuários para configurar permissões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modulosDisponiveis.map((m) => (
                <div key={m.key} className="flex justify-between py-2">
                  <span>{m.nome}</span>
                  <Switch />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showNovoUsuario && (
        <div>
          <Input
            placeholder="Nome"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
