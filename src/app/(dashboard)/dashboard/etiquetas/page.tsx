"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Interfaces
interface TipoEtiqueta {
  id: string;
  nome: "MANIPULACAO" | "REVALIDAR";
  descricao: string;
}

interface TamanhoEtiqueta {
  id: string;
  nome: string;
  largura: number;
  altura: number;
}

interface EtiquetaGerada {
  id: number;
  tipo: "MANIPULACAO" | "REVALIDAR";
  tamanho: string;
  insumo: string;
  qtd: number;
  umd: string;
  dataManip: string;
  dataVenc: string;
  loteMan: string;
  responsavel: string;
  alergenico?: string;
  armazenamento?: string;
  ingredientes?: string;
  dataFabricante?: string;
  dataVencimento?: string;
  sif?: string;
  loteFab?: string;
  localEnvio?: string;
  localArmazenado?: string;
  createdAt: string;
}

// Dados de exemplo
const tiposEtiqueta: TipoEtiqueta[] = [
  { id: "1", nome: "MANIPULACAO", descricao: "Etiqueta de manipulação padrão" },
  { id: "2", nome: "REVALIDAR", descricao: "Etiqueta de revalidação com dados do fabricante" }
];

const tamanhosEtiqueta: TamanhoEtiqueta[] = [
  { id: "1", nome: "Pequena", largura: 5.0, altura: 3.0 },
  { id: "2", nome: "Média", largura: 10.0, altura: 6.0 },
  { id: "3", nome: "Grande", largura: 15.0, altura: 10.0 }
];

const etiquetasGeradasExemplo: EtiquetaGerada[] = [
  {
    id: 1,
    tipo: "MANIPULACAO",
    tamanho: "Média",
    insumo: "Pão Francês",
    qtd: 50,
    umd: "un",
    dataManip: "2024-01-15",
    dataVenc: "2024-01-17",
    loteMan: "MAN240115001",
    responsavel: "João Silva",
    alergenico: "Glúten",
    armazenamento: "Temperatura ambiente",
    ingredientes: "Farinha, água, fermento, sal",
    localEnvio: "Padaria São João",
    localArmazenado: "Estoque Seco",
    createdAt: "2024-01-15T08:30:00"
  },
  {
    id: 2,
    tipo: "REVALIDAR",
    tamanho: "Grande",
    insumo: "Carne Bovina",
    qtd: 5,
    umd: "kg",
    dataManip: "2024-01-15",
    dataVenc: "2024-01-18",
    loteMan: "MAN240115002",
    responsavel: "Maria Santos",
    dataFabricante: "2024-01-10",
    dataVencimento: "2024-01-20",
    sif: "SIF 123",
    loteFab: "FAB240110001",
    alergenico: "Não contém",
    armazenamento: "Refrigeração 0-4°C",
    localEnvio: "Restaurante Bella Vista",
    localArmazenado: "Câmara Fria",
    createdAt: "2024-01-15T09:15:00"
  }
];

export default function EtiquetasPage() {
  const [etiquetasGeradas] = useState(etiquetasGeradasExemplo);
  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<"MANIPULACAO" | "REVALIDAR" | "">("");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");

  // Estados do formulário
  const [formData, setFormData] = useState({
    insumo: "",
    qtd: "",
    umd: "",
    dataManip: "",
    dataVenc: "",
    responsavel: "Admin User",
    alergenico: "",
    armazenamento: "",
    ingredientes: "",
    dataFabricante: "",
    dataVencimento: "",
    sif: "",
    loteFab: "",
    localEnvio: "",
    localArmazenado: ""
  });

  const gerarLoteManipulacao = () => {
    const hoje = new Date();
    const ano = hoje.getFullYear().toString().slice(-2);
    const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const dia = hoje.getDate().toString().padStart(2, '0');
    const sequencial = (etiquetasGeradas.length + 1).toString().padStart(3, '0');
    return `MAN${ano}${mes}${dia}${sequencial}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGerarEtiqueta = () => {
    // TODO: Implementar lógica de geração de etiqueta
    console.log("Gerar etiqueta:", {
      tipo: tipoSelecionado,
      tamanho: tamanhoSelecionado,
      ...formData,
      loteMan: gerarLoteManipulacao()
    });
    setShowNovaEtiqueta(false);
  };

  const handleImprimirEtiqueta = (id: number) => {
    // TODO: Implementar impressão térmica
    console.log("Imprimir etiqueta:", id);
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Etiquetas</h1>
          <p className="text-gray-600">Impressão térmica de etiquetas de manipulação e revalidação</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📊</span>
            Relatório de Etiquetas
          </Button>
          <Button onClick={() => setShowNovaEtiqueta(true)}>
            <span className="mr-2">🏷️</span>
            Nova Etiqueta
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Etiquetas</CardTitle>
            <span className="text-2xl">🏷️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{etiquetasGeradas.length}</div>
            <p className="text-xs text-muted-foreground">
              Etiquetas geradas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manipulação</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {etiquetasGeradas.filter(e => e.tipo === "MANIPULACAO").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Etiquetas de manipulação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revalidação</CardTitle>
            <span className="text-2xl">🔄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {etiquetasGeradas.filter(e => e.tipo === "REVALIDAR").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Etiquetas de revalidação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {etiquetasGeradas.filter(e => e.createdAt.startsWith("2024-01-15")).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Etiquetas geradas hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tipos de Etiqueta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tiposEtiqueta.map((tipo) => (
          <Card key={tipo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">{tipo.nome === "MANIPULACAO" ? "📝" : "🔄"}</span>
                {tipo.nome}
              </CardTitle>
              <CardDescription>{tipo.descricao}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><strong>Campos obrigatórios:</strong></p>
                <ul className="list-disc list-inside text-gray-600">
                  <li>Insumo, Quantidade, Unidade</li>
                  <li>Data de Manipulação, Data de Vencimento</li>
                  <li>Lote de Manipulação, Responsável</li>
                  {tipo.nome === "REVALIDAR" && (
                    <>
                      <li>Data do Fabricante, Data de Vencimento Original</li>
                      <li>SIF, Lote do Fabricante</li>
                    </>
                  )}
                </ul>
              </div>
              <Button 
                className="w-full mt-4" 
                onClick={() => {
                  setTipoSelecionado(tipo.nome);
                  setShowNovaEtiqueta(true);
                }}
              >
                Criar Etiqueta {tipo.nome}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tamanhos Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Tamanhos de Etiqueta Disponíveis</CardTitle>
          <CardDescription>
            Configurações de tamanho para impressão térmica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tamanhosEtiqueta.map((tamanho) => (
              <div key={tamanho.id} className="p-4 border rounded-lg text-center">
                <h3 className="font-semibold">{tamanho.nome}</h3>
                <p className="text-sm text-gray-600">
                  {tamanho.largura}cm × {tamanho.altura}cm
                </p>
                <div className="mt-2 mx-auto bg-gray-100 rounded" 
                     style={{
                       width: `${tamanho.largura * 8}px`,
                       height: `${tamanho.altura * 8}px`,
                       maxWidth: '120px',
                       maxHeight: '80px'
                     }}>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Etiquetas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Etiquetas Geradas</CardTitle>
          <CardDescription>
            Todas as etiquetas geradas com opção de reimpressão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Insumo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {etiquetasGeradas.map((etiqueta) => (
                <TableRow key={etiqueta.id}>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={etiqueta.tipo === "MANIPULACAO" ? "bg-blue-500 text-white" : "bg-green-500 text-white"}
                    >
                      {etiqueta.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{etiqueta.insumo}</TableCell>
                  <TableCell>{etiqueta.qtd} {etiqueta.umd}</TableCell>
                  <TableCell className="font-mono text-sm">{etiqueta.loteMan}</TableCell>
                  <TableCell>{etiqueta.responsavel}</TableCell>
                  <TableCell>{formatDateTime(etiqueta.createdAt)}</TableCell>
                  <TableCell>{formatDate(etiqueta.dataVenc)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p><strong>Envio:</strong> {etiqueta.localEnvio}</p>
                      <p><strong>Armazenado:</strong> {etiqueta.localArmazenado}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleImprimirEtiqueta(etiqueta.id)}
                      >
                        🖨️
                      </Button>
                      <Button size="sm" variant="outline">
                        👁️
                      </Button>
                      <Button size="sm" variant="outline">
                        📋
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Nova Etiqueta */}
      {showNovaEtiqueta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                Nova Etiqueta {tipoSelecionado && `- ${tipoSelecionado}`}
              </h3>
              <Button variant="ghost" onClick={() => setShowNovaEtiqueta(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Seleção de Tipo e Tamanho */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Etiqueta</Label>
                  <Select value={tipoSelecionado} onValueChange={(value: "MANIPULACAO" | "REVALIDAR") => setTipoSelecionado(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANIPULACAO">MANIPULAÇÃO</SelectItem>
                      <SelectItem value="REVALIDAR">REVALIDAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tamanho da Etiqueta</Label>
                  <Select value={tamanhoSelecionado} onValueChange={setTamanhoSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {tamanhosEtiqueta.map((tamanho) => (
                        <SelectItem key={tamanho.id} value={tamanho.nome}>
                          {tamanho.nome} ({tamanho.largura}×{tamanho.altura}cm)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campos Básicos */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="insumo">Insumo/Produto *</Label>
                  <Input 
                    id="insumo" 
                    value={formData.insumo}
                    onChange={(e) => handleInputChange("insumo", e.target.value)}
                    placeholder="Nome do produto"
                  />
                </div>
                <div>
                  <Label htmlFor="qtd">Quantidade *</Label>
                  <Input 
                    id="qtd" 
                    type="number"
                    value={formData.qtd}
                    onChange={(e) => handleInputChange("qtd", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="umd">Unidade *</Label>
                  <Select value={formData.umd} onValueChange={(value) => handleInputChange("umd", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="lt">lt</SelectItem>
                      <SelectItem value="ml">ml</SelectItem>
                      <SelectItem value="un">un</SelectItem>
                      <SelectItem value="cx">cx</SelectItem>
                      <SelectItem value="pct">pct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dataManip">Data de Manipulação *</Label>
                  <Input 
                    id="dataManip" 
                    type="date"
                    value={formData.dataManip}
                    onChange={(e) => handleInputChange("dataManip", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dataVenc">Data de Vencimento *</Label>
                  <Input 
                    id="dataVenc" 
                    type="date"
                    value={formData.dataVenc}
                    onChange={(e) => handleInputChange("dataVenc", e.target.value)}
                  />
                </div>
              </div>

              {/* Campos Específicos para REVALIDAR */}
              {tipoSelecionado === "REVALIDAR" && (
                <div className="p-4 bg-green-50 rounded-lg space-y-4">
                  <h4 className="font-semibold text-green-800">Dados do Fabricante</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dataFabricante">Data do Fabricante</Label>
                      <Input 
                        id="dataFabricante" 
                        type="date"
                        value={formData.dataFabricante}
                        onChange={(e) => handleInputChange("dataFabricante", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dataVencimento">Data Vencimento Original</Label>
                      <Input 
                        id="dataVencimento" 
                        type="date"
                        value={formData.dataVencimento}
                        onChange={(e) => handleInputChange("dataVencimento", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sif">SIF</Label>
                      <Input 
                        id="sif" 
                        value={formData.sif}
                        onChange={(e) => handleInputChange("sif", e.target.value)}
                        placeholder="Ex: SIF 123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="loteFab">Lote do Fabricante</Label>
                      <Input 
                        id="loteFab" 
                        value={formData.loteFab}
                        onChange={(e) => handleInputChange("loteFab", e.target.value)}
                        placeholder="Lote original"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Informações Adicionais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="responsavel">Responsável *</Label>
                  <Input 
                    id="responsavel" 
                    value={formData.responsavel}
                    onChange={(e) => handleInputChange("responsavel", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="alergenico">Alergênico</Label>
                  <Input 
                    id="alergenico" 
                    value={formData.alergenico}
                    onChange={(e) => handleInputChange("alergenico", e.target.value)}
                    placeholder="Ex: Glúten, Lactose"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="armazenamento">Condições de Armazenamento</Label>
                <Input 
                  id="armazenamento" 
                  value={formData.armazenamento}
                  onChange={(e) => handleInputChange("armazenamento", e.target.value)}
                  placeholder="Ex: Refrigeração 0-4°C"
                />
              </div>

              <div>
                <Label htmlFor="ingredientes">Ingredientes</Label>
                <Textarea 
                  id="ingredientes" 
                  value={formData.ingredientes}
                  onChange={(e) => handleInputChange("ingredientes", e.target.value)}
                  placeholder="Lista de ingredientes..."
                  rows={3}
                />
              </div>

              {/* Localização */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="localEnvio">Local de Envio</Label>
                  <Input 
                    id="localEnvio" 
                    value={formData.localEnvio}
                    onChange={(e) => handleInputChange("localEnvio", e.target.value)}
                    placeholder="Para onde será enviado"
                  />
                </div>
                <div>
                  <Label htmlFor="localArmazenado">Local de Armazenamento</Label>
                  <Input 
                    id="localArmazenado" 
                    value={formData.localArmazenado}
                    onChange={(e) => handleInputChange("localArmazenado", e.target.value)}
                    placeholder="Onde está armazenado"
                  />
                </div>
              </div>

              {/* Preview da Etiqueta */}
              {tipoSelecionado && tamanhoSelecionado && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Preview da Etiqueta</h4>
                  <div className="border-2 border-dashed border-gray-300 p-4 bg-white rounded text-sm">
                    <div className="text-center font-bold mb-2">{tipoSelecionado}</div>
                    <div><strong>Produto:</strong> {formData.insumo || "[Produto]"}</div>
                    <div><strong>Qtd:</strong> {formData.qtd || "[Qtd]"} {formData.umd || "[Unidade]"}</div>
                    <div><strong>Manipulação:</strong> {formData.dataManip || "[Data]"}</div>
                    <div><strong>Vencimento:</strong> {formData.dataVenc || "[Data]"}</div>
                    <div><strong>Lote:</strong> {gerarLoteManipulacao()}</div>
                    <div><strong>Responsável:</strong> {formData.responsavel}</div>
                    {formData.alergenico && <div><strong>Alergênico:</strong> {formData.alergenico}</div>}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowNovaEtiqueta(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleGerarEtiqueta} disabled={!tipoSelecionado || !tamanhoSelecionado}>
                  <span className="mr-2">🖨️</span>
                  Gerar e Imprimir Etiqueta
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}