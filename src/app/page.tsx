import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G2</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Gestão 2.0</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Entrar</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Sistema Completo de Gestão para Restaurantes
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Controle total de pedidos, produção, estoque e produtividade em uma única plataforma moderna e intuitiva.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
              Começar Agora
            </Button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/1bc6e7d4-5053-4e56-aa37-3b0936891db5.png" alt="Ícone de pedidos" className="w-8 h-8" />
              </div>
              <CardTitle>Gestão de Pedidos</CardTitle>
              <CardDescription>
                Kanban intuitivo para acompanhar pedidos em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Fluxo visual de pedidos</li>
                <li>• Cálculo automático de custos</li>
                <li>• Controle de prazos de entrega</li>
                <li>• Atualizações em tempo real</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/0b3aaeeb-3513-4bfe-ab18-4a9f97ab8a19.png" alt="Ícone de produção" className="w-8 h-8" />
              </div>
              <CardTitle>KDS - Monitor de Cozinha</CardTitle>
              <CardDescription>
                Sistema de display para cozinha com controle de produção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Monitor em tempo real</li>
                <li>• Delegação de tarefas</li>
                <li>• Controle de tempo</li>
                <li>• Registro de produtividade</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/154a078e-69ab-4aaf-91a5-8fa72cb9cdc9.png" alt="Ícone de estoque" className="w-8 h-8" />
              </div>
              <CardTitle>Controle de Estoque</CardTitle>
              <CardDescription>
                Gestão completa de estoque com inventário inteligente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Estoque em tempo real</li>
                <li>• Alertas de estoque mínimo</li>
                <li>• Sistema de inventário</li>
                <li>• Controle de perdas</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/7fae28a9-eac2-46a9-8193-57bbe14dfcc7.png" alt="Ícone de produtividade" className="w-8 h-8" />
              </div>
              <CardTitle>Produtividade</CardTitle>
              <CardDescription>
                Ranking e métricas de desempenho dos colaboradores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Ranking de colaboradores</li>
                <li>• Métricas por período</li>
                <li>• Relatórios detalhados</li>
                <li>• Análise de performance</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/66d1d304-9d4d-4a84-afef-b9cfc182934c.png" alt="Ícone de ficha técnica" className="w-8 h-8" />
              </div>
              <CardTitle>Ficha Técnica</CardTitle>
              <CardDescription>
                Receitas com cálculo automático de custos e CMV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Cadastro de receitas</li>
                <li>• Cálculo de custos</li>
                <li>• Controle de CMV</li>
                <li>• Análise de rentabilidade</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <img src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/a990a988-3c2a-4d70-a18e-5342d505fc5c.png" alt="Ícone de etiquetas" className="w-8 h-8" />
              </div>
              <CardTitle>Sistema de Etiquetas</CardTitle>
              <CardDescription>
                Impressão térmica de etiquetas de manipulação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Etiquetas de manipulação</li>
                <li>• Etiquetas de revalidação</li>
                <li>• Impressão térmica</li>
                <li>• Histórico completo</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Pronto para revolucionar sua gestão?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Junte-se a centenas de restaurantes que já otimizaram seus processos com o Gestão 2.0.
            Sistema completo, moderno e fácil de usar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                Acessar Sistema
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              Solicitar Demo
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 Gestão 2.0. Sistema completo de gestão para restaurantes.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}