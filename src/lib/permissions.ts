// Sistema de permissões persistente

export interface Permissao {
  userId: string;
  modulo: string;
  podeVisualizar: boolean;
  podeEditar: boolean;
}

export interface Usuario {
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

// Simulação de armazenamento local

const usuariosGlobais: Usuario[] = [
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



let permissoesGlobais: Permissao[] = [ // eslint-disable-line prefer-const
  // Permissões do Admin User (acesso total)
  { userId: "1", modulo: "pedidos", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "producao", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "estoque", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "inventario", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "fichas_tecnicas", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "etiquetas", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "compras", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "produtividade", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "admin", podeVisualizar: true, podeEditar: true },
  { userId: "1", modulo: "insumos", podeVisualizar: true, podeEditar: true },
  
  // Permissões do João Silva (Chefe de Cozinha)
  { userId: "2", modulo: "pedidos", podeVisualizar: true, podeEditar: false },
  { userId: "2", modulo: "producao", podeVisualizar: true, podeEditar: true },
  { userId: "2", modulo: "estoque", podeVisualizar: true, podeEditar: false },
  { userId: "2", modulo: "inventario", podeVisualizar: true, podeEditar: true },
  { userId: "2", modulo: "fichas_tecnicas", podeVisualizar: true, podeEditar: true },
  { userId: "2", modulo: "etiquetas", podeVisualizar: true, podeEditar: false },
  { userId: "2", modulo: "compras", podeVisualizar: false, podeEditar: false },
  { userId: "2", modulo: "produtividade", podeVisualizar: true, podeEditar: false },
  { userId: "2", modulo: "admin", podeVisualizar: false, podeEditar: false },
  { userId: "2", modulo: "insumos", podeVisualizar: true, podeEditar: true }
];

// Funções para gerenciar usuários
export function obterUsuarios(): Usuario[] {
  return [...usuariosGlobais];
}

export function adicionarUsuario(usuario: Omit<Usuario, 'id' | 'createdAt'>): Usuario {
  const novoUsuario: Usuario = {
    ...usuario,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  };
  
  usuariosGlobais.push(novoUsuario);
  
  // Criar permissões padrão para o novo usuário
  const modulosDisponiveis = [
    "pedidos", "producao", "estoque", "inventario", 
    "fichas_tecnicas", "etiquetas", "compras", 
    "produtividade", "admin", "insumos"
  ];
  
  modulosDisponiveis.forEach(modulo => {
    permissoesGlobais.push({
      userId: novoUsuario.id,
      modulo,
      podeVisualizar: usuario.role === "admin",
      podeEditar: usuario.role === "admin"
    });
  });
  
  return novoUsuario;
}

export function atualizarUsuario(id: string, dadosAtualizados: Partial<Usuario>): boolean {
  const index = usuariosGlobais.findIndex(u => u.id === id);
  if (index !== -1) {
    usuariosGlobais[index] = { ...usuariosGlobais[index], ...dadosAtualizados };
    return true;
  }
  return false;
}

export function toggleStatusUsuario(id: string): boolean {
  const index = usuariosGlobais.findIndex(u => u.id === id);
  if (index !== -1) {
    usuariosGlobais[index].ativo = !usuariosGlobais[index].ativo;
    return true;
  }
  return false;
}

// Funções para gerenciar permissões
export function obterPermissoesUsuario(userId: string): Permissao[] {
  return permissoesGlobais.filter(p => p.userId === userId);
}

export function atualizarPermissao(userId: string, modulo: string, podeVisualizar: boolean, podeEditar: boolean): boolean {
  const index = permissoesGlobais.findIndex(p => p.userId === userId && p.modulo === modulo);
  
  if (index !== -1) {
    permissoesGlobais[index] = { userId, modulo, podeVisualizar, podeEditar };
  } else {
    permissoesGlobais.push({ userId, modulo, podeVisualizar, podeEditar });
  }
  
  return true;
}

export function salvarPermissoesUsuario(userId: string, permissoes: { modulo: string; podeVisualizar: boolean; podeEditar: boolean; }[]): boolean {
  // Remover permissões existentes do usuário
  permissoesGlobais = permissoesGlobais.filter(p => p.userId !== userId);
  
  // Adicionar novas permissões
  permissoes.forEach(permissao => {
    permissoesGlobais.push({
      userId,
      modulo: permissao.modulo,
      podeVisualizar: permissao.podeVisualizar,
      podeEditar: permissao.podeEditar
    });
  });
  
  return true;
}