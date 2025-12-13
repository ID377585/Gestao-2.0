import { NextRequest, NextResponse } from 'next/server';

// Simulação de dados para exportação
const dadosSimulados = {
  pedidos: [
    { id: 1, estabelecimento: 'Restaurante Bella Vista', data: '2024-01-15', valor: 450.80, status: 'concluido' },
    { id: 2, estabelecimento: 'Padaria São João', data: '2024-01-14', valor: 280.50, status: 'concluido' },
    { id: 3, estabelecimento: 'Hotel Cinco Estrelas', data: '2024-01-13', valor: 1250.00, status: 'concluido' }
  ],
  insumos: [
    { id: 1, nome: 'Farinha de Trigo', unidade: 'kg', preco: 4.50, categoria: 'Farinhas' },
    { id: 2, nome: 'Açúcar Cristal', unidade: 'kg', preco: 3.20, categoria: 'Açúcares' },
    { id: 3, nome: 'Ovos', unidade: 'un', preco: 0.45, categoria: 'Proteínas' }
  ],
  produtividade: [
    { colaborador: 'João Silva', cargo: 'Padeiro', peso_kg: 45.5, valor_peso: 850.30, unidades: 120, valor_unidades: 540.00 },
    { colaborador: 'Maria Santos', cargo: 'Confeiteira', peso_kg: 32.8, valor_peso: 920.40, unidades: 85, valor_unidades: 765.50 },
    { colaborador: 'Pedro Costa', cargo: 'Chefe de Cozinha', peso_kg: 28.2, valor_peso: 1120.80, unidades: 95, valor_unidades: 890.20 }
  ]
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tabela: string }> }
) {
  try {
    const { tabela } = await context.params;
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') || 'csv';
    const dataInicio = searchParams.get('dataInicio');
    const dataFim = searchParams.get('dataFim');

    // Validar tabela
    if (!dadosSimulados[tabela as keyof typeof dadosSimulados]) {
      return NextResponse.json(
        { error: 'Tabela não encontrada' },
        { status: 404 }
      );
    }

    const dados = dadosSimulados[tabela as keyof typeof dadosSimulados];

    if (formato === 'csv') {
      // Gerar CSV
      const headers = Object.keys(dados[0]);
      const csvContent = [
        headers.join(','),
        ...dados.map(row => 
          headers.map(header => 
            typeof row[header as keyof typeof row] === 'string' 
              ? `"${row[header as keyof typeof row]}"` 
              : row[header as keyof typeof row]
          ).join(',')
        )
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${tabela}_${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else if (formato === 'xlsx') {
      // Para XLSX, retornaria dados estruturados que seriam processados no frontend
      return NextResponse.json({
        dados,
        metadados: {
          tabela,
          total: dados.length,
          dataExportacao: new Date().toISOString(),
          filtros: { dataInicio, dataFim }
        }
      });
    }

    return NextResponse.json({ error: 'Formato não suportado' }, { status: 400 });

  } catch (error) {
    console.error('Erro na exportação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}