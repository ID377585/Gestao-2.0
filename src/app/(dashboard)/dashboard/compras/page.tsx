"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
interface ImportacaoHistorico {
  id: number;
  tabela: string;
  arquivo: string;
  registrosImportados: number;
  registrosErro: number;
  status: "sucesso" | "erro" | "parcial";
  dataImportacao: string;
  usuario: string;
}

interface ExportacaoHistorico {
  id: number;
  tabela: string;
  formato: "csv" | "xlsx";
  registrosExportados: number;
  dataInicio: string;
  dataFim: string;
  dataExportacao: string;
  usuario: string;
}

// Dados de exemplo
const importacoesExemplo: ImportacaoHistorico[] = [
  {
    id: 1,
    tabela: "insumos",
    arquivo: "insumos_janeiro_2024.xlsx",
    registrosImportados: 45,
    registrosErro: 2,
    status: "parcial",
    dataImportacao: "2024-01-15T10:30:00",
    usuario: "Admin User"
  },
  {
    id: 2,
    tabela: "estabelecimentos",
    arquivo: "clientes_novos.csv",
    registrosImportados: 12,
    registrosErro: 0,
    status: "sucesso",
    dataImportacao: "2024-01-14T14:20:00",
    usuario: "João Silva"
  },
  {
    id: 3,
    tabela: "entradas",
    arquivo: "compras_dezembro.xlsx",
    registrosImportados: 0,
    registrosErro: 25,
    status: "erro",
    dataImportacao: "2024-01-13T09:15:00",
    usuario: "Maria Santos"
  }
];

const exportacoesExemplo: ExportacaoHistorico[] = [
  {
    id: 1,
    tabela: "pedidos",
    formato: "xlsx",
    registrosExportados: 150,
    dataInicio: "2024-01-01",
    dataFim: "2024-01-15",
    dataExportacao: "2024-01-15T16:45:00",
    usuario: "Admin User"
  },
  {
    id: 2,
    tabela: "produtividade",
    formato: "csv",
    registrosExportados: 89,
    dataInicio: "2024-01-01",
    dataFim: "2024-01-31",
    dataExportacao: "2024-01-14T11:30:00",
    usuario: "Pedro Costa"
  }
];

const tabelasDisponiveis = [
  { value: "insumos", label: "Insumos", descricao: "Produtos e matérias-primas" },
  { value: "estabelecimentos", label: "Estabelecimentos", descricao: "Clientes e fornecedores" },
  { value: "entradas", label: "Entradas", descricao: "Compras e entradas no estoque" },
  { value: "perdas", label: "Perdas", descricao: "Perdas e descartes" },
  { value: "fichas_tecnicas", label: "Fichas Técnicas", descricao: "Receitas e custos" },
  { value: "colaboradores", label: "Colaboradores", descricao: "Funcionários e responsáveis" },
  { value: "pedidos", label: "Pedidos", descricao: "Histórico de pedidos" },
  { value: "produtividade", label: "Produtividade", descricao: "Dados de produtividade" },
  { value: "estoque_atual", label: "Estoque Atual", descricao: "Saldos de estoque" }
];

export default function ComprasPage() {
  const [importacoes] = useState(importacoesExemplo);
  const [exportacoes] = useState(exportacoesExemplo);
  const [tabelaSelecionada, setTabelaSelecionada] = useState("");
  const [formatoExportacao, setFormatoExportacao] = useState("xlsx");
  const [dataInicioExport, setDataInicioExport] = useState("");
  const [dataFimExport, setDataFimExport] = useState("");
  const [arquivoImport, setArquivoImport] = useState<File | null>(null);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sucesso":
        return <Badge className="bg-green-500 text-white">Sucesso</Badge>;
      case "erro":
        return <Badge className="bg-red-500 text-white">Erro</Badge>;
      case "parcial":
        return <Badge className="bg-yellow-500 text-white">Parcial</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setArquivoImport(file);
    }
  };

  const handleImportacao = () => {
    if (!tabelaSelecionada || !arquivoImport) {
      alert("Selecione uma tabela e um arquivo para importar");
      return;
    }
    
    // TODO: Implementar lógica de importação
    console.log("Importar:", {
      tabela: tabelaSelecionada,
      arquivo: arquivoImport.name,
      tamanho: arquivoImport.size
    });
    
    alert(`Importação iniciada para tabela: ${tabelaSelecionada}\nArquivo: ${arquivoImport.name}`);
  };

  const handleExportacao = () => {
    if (!tabelaSelecionada) {
      alert("Selecione uma tabela para exportar");
      return;
    }
    
    // TODO: Implementar lógica de exportação
    console.log("Exportar:", {
      tabela: tabelaSelecionada,
      formato: formatoExportacao,
      dataInicio: dataInicioExport,
      dataFim: dataFimExport
    });
    
    // Simular download
    const nomeArquivo = `${tabelaSelecionada}_${new Date().toISOString().split('T')[0]}.${formatoExportacao}`;
    alert(`Exportação iniciada!\nArquivo: ${nomeArquivo}`);
  };

  const downloadTemplate = (tabela: string) => {
    // TODO: Implementar download de template
    console.log("Download template:", tabela);
    alert(`Template para ${tabela} será baixado`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compras - Import/Export</h1>
          <p className="text-gray-600">Importação e exportação de dados em CSV/XLSX</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📋</span>
            Templates
          </Button>
          <Button variant="outline">
            <span className="mr-2">📖</span>
            Manual
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Importações</CardTitle>
            <span className="text-2xl">📥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importacoes.length}</div>
            <p className="text-xs text-muted-foreground">
              Total realizadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportações</CardTitle>
            <span className="text-2xl">📤</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exportacoes.length}</div>
            <p className="text-xs text-muted-foreground">
              Total realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros Importados</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {importacoes.reduce((acc, imp) => acc + imp.registrosImportados, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {importacoes.length > 0 
                ? ((importacoes.filter(i => i.status === "sucesso").length / importacoes.length) * 100).toFixed(0)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Importações bem-sucedidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para Import/Export */}
      <Tabs defaultValue="importacao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="importacao">📥 Importação</TabsTrigger>
          <TabsTrigger value="exportacao">📤 Exportação</TabsTrigger>
        </TabsList>

        {/* Tab Importação */}
        <TabsContent value="importacao" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Importar Dados</CardTitle>
              <CardDescription>
                Faça upload de arquivos CSV ou XLSX para importar dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tabela de Destino</Label>
                  <Select value={tabelaSelecionada} onValueChange={setTabelaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {tabelasDisponiveis.map((tabela) => (
                        <SelectItem key={tabela.value} value={tabela.value}>
                          {tabela.label} - {tabela.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Arquivo</Label>
                  <Input 
                    type="file" 
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {tabelaSelecionada && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Template disponível para {tabelaSelecionada}</p>
                      <p className="text-sm text-gray-600">
                        Baixe o template para garantir o formato correto
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadTemplate(tabelaSelecionada)}
                    >
                      📥 Baixar Template
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline">
                  Validar Arquivo
                </Button>
                <Button onClick={handleImportacao} disabled={!tabelaSelecionada || !arquivoImport}>
                  <span className="mr-2">📥</span>
                  Importar Dados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Importações */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Importações</CardTitle>
              <CardDescription>
                Últimas importações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Erros</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importacoes.map((importacao) => (
                    <TableRow key={importacao.id}>
                      <TableCell className="font-medium">
                        {tabelasDisponiveis.find(t => t.value === importacao.tabela)?.label || importacao.tabela}
                      </TableCell>
                      <TableCell>{importacao.arquivo}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {importacao.registrosImportados}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {importacao.registrosErro}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(importacao.status)}
                      </TableCell>
                      <TableCell>{formatDateTime(importacao.dataImportacao)}</TableCell>
                      <TableCell>{importacao.usuario}</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline">
                            📋
                          </Button>
                          <Button size="sm" variant="outline">
                            📥
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

        {/* Tab Exportação */}
        <TabsContent value="exportacao" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exportar Dados</CardTitle>
              <CardDescription>
                Exporte dados em formato CSV ou XLSX com filtro de período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tabela</Label>
                  <Select value={tabelaSelecionada} onValueChange={setTabelaSelecionada}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {tabelasDisponiveis.map((tabela) => (
                        <SelectItem key={tabela.value} value={tabela.value}>
                          {tabela.label} - {tabela.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Formato</Label>
                  <Select value={formatoExportacao} onValueChange={setFormatoExportacao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                      <SelectItem value="csv">CSV (.csv)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Input 
                    type="date" 
                    value={dataInicioExport}
                    onChange={(e) => setDataInicioExport(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Data Fim</Label>
                  <Input 
                    type="date" 
                    value={dataFimExport}
                    onChange={(e) => setDataFimExport(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline">
                  Visualizar Dados
                </Button>
                <Button onClick={handleExportacao} disabled={!tabelaSelecionada}>
                  <span className="mr-2">📤</span>
                  Exportar Dados
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Exportações */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Exportações</CardTitle>
              <CardDescription>
                Últimas exportações realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Data Exportação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportacoes.map((exportacao) => (
                    <TableRow key={exportacao.id}>
                      <TableCell className="font-medium">
                        {tabelasDisponiveis.find(t => t.value === exportacao.tabela)?.label || exportacao.tabela}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {exportacao.formato.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {exportacao.registrosExportados}
                      </TableCell>
                      <TableCell>
                        {formatDate(exportacao.dataInicio)} - {formatDate(exportacao.dataFim)}
                      </TableCell>
                      <TableCell>{formatDateTime(exportacao.dataExportacao)}</TableCell>
                      <TableCell>{exportacao.usuario}</TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline">
                            📥
                          </Button>
                          <Button size="sm" variant="outline">
                            🔄
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
      </Tabs>

      {/* Integração Power BI */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="mr-2">📊</span>
            Integração com Power BI
          </CardTitle>
          <CardDescription>
            Configure a conexão com Power BI para análises avançadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Views Disponíveis:</h4>
              <ul className="text-sm space-y-1">
                <li>• view_estoque_completo - Estoque com alertas</li>
                <li>• view_produtividade_colaborador - Métricas por colaborador</li>
                <li>• view_historico_pedidos - Histórico completo</li>
                <li>• view_custos_fichas_tecnicas - Análise de custos</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">String de Conexão:</h4>
              <div className="p-3 bg-gray-100 rounded text-sm font-mono">
                Server=your-supabase-url;Database=postgres;
                <br />
                User=your-user;Password=your-password
              </div>
              <Button className="mt-2" size="sm">
                Copiar String
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}