// Sistema de notificações para pedidos e alterações de status

export interface Notificacao {
  id: number;
  titulo: string;
  mensagem: string;
  tipo: "info" | "warning" | "success" | "error";
  lida: boolean;
  dataHora: string;
  pedidoId?: number;
  usuarioId?: string;
}

// Simulação de armazenamento local das notificações
let notificacoesGlobais: Notificacao[] = [
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
    dataHora: "2024-01-15T09:15:00",
    pedidoId: 2
  },
  {
    id: 3,
    titulo: "Novo Usuário",
    mensagem: "Carlos Mendes foi adicionado ao sistema como Auxiliar de Cozinha.",
    tipo: "info",
    lida: true,
    dataHora: "2024-01-15T08:45:00"
  }
];

// Função para adicionar nova notificação
export function adicionarNotificacao(notificacao: Omit<Notificacao, 'id' | 'dataHora' | 'lida'>) {
  const novaNotificacao: Notificacao = {
    ...notificacao,
    id: Date.now(),
    dataHora: new Date().toISOString(),
    lida: false
  };
  
  notificacoesGlobais.unshift(novaNotificacao);
  
  // Manter apenas as últimas 50 notificações
  if (notificacoesGlobais.length > 50) {
    notificacoesGlobais = notificacoesGlobais.slice(0, 50);
  }
  
  return novaNotificacao;
}

// Função para obter todas as notificações
export function obterNotificacoes(): Notificacao[] {
  return [...notificacoesGlobais];
}

// Função para marcar notificação como lida
export function marcarNotificacaoLida(id: number) {
  const index = notificacoesGlobais.findIndex(n => n.id === id);
  if (index !== -1) {
    notificacoesGlobais[index].lida = true;
  }
}

// Função para marcar todas como lidas
export function marcarTodasLidas() {
  notificacoesGlobais.forEach(n => n.lida = true);
}

// Função para notificar mudança de status de pedido
export function notificarMudancaStatusPedido(
  pedidoId: number, 
  statusAnterior: string, 
  novoStatus: string, 
  estabelecimento: string,
  usuarioResponsavel: string
) {
  const statusLabels: Record<string, string> = {
    criado: "Criado",
    em_preparo: "Em Preparo",
    separacao: "Separação",
    conferencia: "Conferência",
    saiu_entrega: "Saiu para Entrega",
    entrega_concluida: "Entrega Concluída",
    cancelado: "Cancelado"
  };

  const tipoNotificacao = novoStatus === "cancelado" ? "error" : 
                         novoStatus === "entrega_concluida" ? "success" : "info";

  adicionarNotificacao({
    titulo: `Pedido #${pedidoId} - Status Atualizado`,
    mensagem: `Pedido para ${estabelecimento} mudou de "${statusLabels[statusAnterior]}" para "${statusLabels[novoStatus]}" por ${usuarioResponsavel}`,
    tipo: tipoNotificacao,
    pedidoId,
    usuarioId: usuarioResponsavel
  });
}

// Função para notificar novo pedido
export function notificarNovoPedido(
  pedidoId: number,
  estabelecimento: string,
  valorTotal: number,
  totalItens: number,
  usuarioCriador: string
) {
  adicionarNotificacao({
    titulo: `Novo Pedido #${pedidoId} Criado`,
    mensagem: `Pedido para ${estabelecimento} criado com ${totalItens} itens no valor de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)} por ${usuarioCriador}`,
    tipo: "info",
    pedidoId,
    usuarioId: usuarioCriador
  });
}

// Função para notificar estoque baixo
export function notificarEstoqueBaixo(produto: string, quantidadeAtual: number, unidade: string, estoqueMinimo: number) {
  adicionarNotificacao({
    titulo: "Alerta de Estoque",
    mensagem: `${produto} está com estoque baixo: ${quantidadeAtual} ${unidade} (mínimo: ${estoqueMinimo} ${unidade})`,
    tipo: "warning"
  });
}

// Função para notificar produção finalizada
export function notificarProducaoFinalizada(
  produto: string,
  quantidade: number,
  unidade: string,
  colaborador: string,
  tempoTotal: number
) {
  adicionarNotificacao({
    titulo: "Produção Finalizada",
    mensagem: `${colaborador} finalizou a produção de ${quantidade} ${unidade} de ${produto} em ${tempoTotal} minutos`,
    tipo: "success"
  });
}