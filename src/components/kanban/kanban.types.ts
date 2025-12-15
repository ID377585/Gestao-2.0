export type KanbanStatus =
  | "criado"
  | "em_preparo"
  | "separacao"
  | "conferencia"
  | "saiu_entrega"
  | "entrega_concluida"
  | "cancelado";

export interface Pedido {
  id: number;
  estabelecimento: string;
  dataEntrega: string; // ISO string ou algo parseável pelo Date()
  valorTotal: number;
  status: KanbanStatus | string; // mantém flexível caso venha outro status
  itens: number;
  progresso: number; // 0..100
}

export type StatusConfigItem = {
  label: string;
  color: string; // classes tailwind, ex: "bg-blue-500"
  textColor?: string;
};

export type KanbanColumnDef = {
  key: KanbanStatus;
  title: string;
};
