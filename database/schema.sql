-- ===============================================================
-- SISTEMA GESTÃO 2.0 - SCHEMA COMPLETO - IVAN ESCOBAR NTSOLUTIONS
-- ===============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. AUTENTICAÇÃO E USUÁRIOS
-- =====================================================

-- Tabela de perfis (ligada ao auth.users do Supabase)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de cargos
CREATE TABLE cargos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    pode_editar_insumos BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir cargos padrão
INSERT INTO cargos (nome, descricao, pode_editar_insumos) VALUES
('Chefe de Cozinha', 'Responsável pela cozinha', true),
('Chefe de Produção', 'Responsável pela produção', true),
('Confeiteiro', 'Especialista em confeitaria', true),
('Padeiro', 'Especialista em panificação', true),
('Masseiro', 'Especialista em massas', true),
('Burrateiro', 'Especialista em burrata', true),
('Açougueiro', 'Especialista em carnes', true),
('Gestor', 'Gestor geral', true),
('Diretor', 'Diretor', true),
('Gerente', 'Gerente', true),
('Proprietário', 'Proprietário', true),
('Auxiliar de Cozinha', 'Auxiliar geral', false),
('Entregador', 'Responsável por entregas', false);

-- Tabela de colaboradores
CREATE TABLE colaboradores (
    id SERIAL PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cargo_id INTEGER REFERENCES cargos(id),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de permissões por módulo
CREATE TABLE permissoes_modulo (
    id SERIAL PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    modulo TEXT NOT NULL CHECK (modulo IN ('pedidos', 'producao', 'estoque', 'inventario', 'fichas_tecnicas', 'etiquetas', 'compras', 'produtividade', 'admin', 'insumos')),
    pode_visualizar BOOLEAN DEFAULT true,
    pode_editar BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, modulo)
);

-- =====================================================
-- 2. ESTABELECIMENTOS E INSUMOS
-- =====================================================

-- Tabela de estabelecimentos (clientes)
CREATE TABLE estabelecimentos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cnpj TEXT,
    endereco TEXT,
    telefone TEXT,
    email TEXT,
    prazo_entrega_dias INTEGER DEFAULT 1,
    tipo_estabelecimento TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de insumos/produtos
CREATE TABLE insumos (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    unidade TEXT NOT NULL CHECK (unidade IN ('kg', 'g', 'lt', 'ml', 'un', 'cx', 'pct')),
    preco_compra DECIMAL(10,2) DEFAULT 0,
    categoria TEXT,
    codigo_barras TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuração de estoque (mínimo, médio, máximo)
CREATE TABLE estoque_config (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    estoque_minimo DECIMAL(10,3) DEFAULT 0,
    estoque_medio DECIMAL(10,3) DEFAULT 0,
    estoque_maximo DECIMAL(10,3) DEFAULT 0,
    local_armazenamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(insumo_id)
);

-- =====================================================
-- 3. PEDIDOS E PRODUÇÃO
-- =====================================================

-- Tabela de pedidos
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    estabelecimento_id INTEGER REFERENCES estabelecimentos(id),
    data_pedido DATE NOT NULL,
    hora_pedido TIME NOT NULL,
    data_entrega_prevista DATE NOT NULL,
    data_entrega_real DATE,
    status TEXT NOT NULL DEFAULT 'criado' CHECK (status IN ('criado', 'em_preparo', 'separacao', 'conferencia', 'saiu_entrega', 'entrega_concluida', 'cancelado')),
    valor_total_custo DECIMAL(10,2) DEFAULT 0,
    quem_criou UUID REFERENCES profiles(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens do pedido
CREATE TABLE pedido_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id),
    produto_nome TEXT NOT NULL,
    quantidade DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    preco_custo_unitario DECIMAL(10,2) NOT NULL,
    preco_custo_total_item DECIMAL(10,2) NOT NULL,
    estoque_antes DECIMAL(10,3),
    estoque_apos DECIMAL(10,3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produção (KDS)
CREATE TABLE producao (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id),
    insumo_id INTEGER REFERENCES insumos(id),
    produto_nome TEXT NOT NULL,
    quantidade DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_preparo', 'finalizado')),
    colaborador_id INTEGER REFERENCES colaboradores(id),
    tempo_inicio TIMESTAMP WITH TIME ZONE,
    tempo_fim TIMESTAMP WITH TIME ZONE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtividade
CREATE TABLE produtividade (
    id SERIAL PRIMARY KEY,
    colaborador_id INTEGER REFERENCES colaboradores(id),
    insumo_id INTEGER REFERENCES insumos(id),
    produto_nome TEXT NOT NULL,
    data_producao DATE NOT NULL,
    quantidade DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    valor_rs DECIMAL(10,2) NOT NULL,
    tipo_producao TEXT CHECK (tipo_producao IN ('peso', 'unidade')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. ESTOQUE
-- =====================================================

-- Tabela de estoque atual
CREATE TABLE estoque_atual (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(10,3) NOT NULL DEFAULT 0,
    local_armazenamento TEXT,
    lote TEXT,
    data_vencimento DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(insumo_id, local_armazenamento, lote)
);

-- Tabela de entradas no estoque
CREATE TABLE entradas (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id),
    quantidade DECIMAL(10,3) NOT NULL,
    preco_unitario DECIMAL(10,2),
    valor_total DECIMAL(10,2),
    tipo_entrada TEXT NOT NULL CHECK (tipo_entrada IN ('compra', 'producao', 'ajuste', 'devolucao')),
    numero_nota TEXT,
    fornecedor TEXT,
    lote TEXT,
    data_vencimento DATE,
    responsavel_id UUID REFERENCES profiles(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de perdas
CREATE TABLE perdas (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id),
    quantidade DECIMAL(10,3) NOT NULL,
    motivo TEXT NOT NULL CHECK (motivo IN ('vencimento', 'deterioracao', 'quebra', 'roubo', 'outros')),
    valor_perda DECIMAL(10,2),
    responsavel_id UUID REFERENCES profiles(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de inventário (cabeçalho)
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    data_inventario TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    colaborador_id UUID REFERENCES profiles(id) NOT NULL,
    estabelecimento_id INTEGER REFERENCES estabelecimentos(id),
    local_setor TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'encerrado')),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens do inventário
CREATE TABLE inventario_itens (
    id SERIAL PRIMARY KEY,
    inventario_id INTEGER REFERENCES inventario(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id),
    produto_nome TEXT NOT NULL,
    quantidade_contada DECIMAL(10,3) NOT NULL,
    unidade TEXT NOT NULL,
    lote TEXT,
    data_vencimento DATE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. FICHA TÉCNICA
-- =====================================================

-- Tabela de fichas técnicas (receitas)
CREATE TABLE fichas_tecnicas (
    id SERIAL PRIMARY KEY,
    nome_receita TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT,
    rendimento INTEGER, -- número de porções
    peso_porcao DECIMAL(10,3), -- em gramas
    tempo_preparo INTEGER, -- em minutos
    temperatura_preparo TEXT,
    modo_preparo TEXT,
    custo_total DECIMAL(10,2) DEFAULT 0,
    custo_por_porcao DECIMAL(10,2) DEFAULT 0,
    margem_lucro DECIMAL(5,2) DEFAULT 0, -- percentual
    preco_venda DECIMAL(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de itens da ficha técnica
CREATE TABLE ficha_tecnica_itens (
    id SERIAL PRIMARY KEY,
    ficha_tecnica_id INTEGER REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
    insumo_id INTEGER REFERENCES insumos(id),
    ingrediente_nome TEXT NOT NULL,
    quantidade DECIMAL(10,3) NOT NULL, -- em gramas/ml/unidades
    unidade TEXT NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    custo_ingrediente DECIMAL(10,2) NOT NULL,
    fator_correcao DECIMAL(5,3) DEFAULT 1.000,
    fator_coccao DECIMAL(5,3) DEFAULT 1.000,
    peso_liquido DECIMAL(10,3),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. ETIQUETAS
-- =====================================================

-- Tipos de etiqueta
CREATE TABLE tipos_etiqueta (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE CHECK (nome IN ('MANIPULACAO', 'REVALIDAR')),
    descricao TEXT,
    campos_obrigatorios TEXT[], -- array de campos obrigatórios
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir tipos padrão
INSERT INTO tipos_etiqueta (nome, descricao, campos_obrigatorios) VALUES
('MANIPULACAO', 'Etiqueta de manipulação', ARRAY['insumo', 'qtd', 'umd', 'data_manip', 'data_venc', 'responsavel']),
('REVALIDAR', 'Etiqueta de revalidação', ARRAY['insumo', 'qtd', 'umd', 'data_manip', 'data_venc', 'data_fabricante', 'data_vencimento', 'sif', 'lote_fab', 'responsavel']);

-- Configuração de tamanhos de etiqueta
CREATE TABLE config_tamanhos_etiqueta (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    largura_cm DECIMAL(5,2) NOT NULL,
    altura_cm DECIMAL(5,2) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir tamanhos padrão
INSERT INTO config_tamanhos_etiqueta (nome, largura_cm, altura_cm) VALUES
('Pequena', 5.0, 3.0),
('Média', 10.0, 6.0),
('Grande', 15.0, 10.0);

-- Histórico de etiquetas geradas
CREATE TABLE etiquetas_geradas (
    id SERIAL PRIMARY KEY,
    tipo_etiqueta_id INTEGER REFERENCES tipos_etiqueta(id),
    tamanho_etiqueta_id INTEGER REFERENCES config_tamanhos_etiqueta(id),
    insumo_id INTEGER REFERENCES insumos(id),
    -- Campos específicos da etiqueta
    insumo TEXT NOT NULL,
    qtd DECIMAL(10,3) NOT NULL,
    umd TEXT NOT NULL,
    data_manip DATE,
    data_venc DATE,
    lote_man TEXT,
    responsavel TEXT,
    alergenico TEXT,
    armazenamento TEXT,
    ingredientes TEXT,
    -- Campos específicos para REVALIDAR
    data_fabricante DATE,
    data_vencimento DATE,
    sif TEXT,
    lote_fab TEXT,
    -- Controle
    usuario_id UUID REFERENCES profiles(id),
    local_envio TEXT,
    local_armazenado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. ORDENS DE PRODUÇÃO
-- =====================================================

-- Tabela de ordens de produção
CREATE TABLE ordens_producao (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER REFERENCES insumos(id),
    produto_nome TEXT NOT NULL,
    quantidade_necessaria DECIMAL(10,3) NOT NULL,
    quantidade_produzida DECIMAL(10,3) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_producao', 'concluida', 'cancelada')),
    prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    motivo TEXT CHECK (motivo IN ('estoque_minimo', 'pedido_especifico', 'planejamento')),
    data_necessaria DATE,
    responsavel_id INTEGER REFERENCES colaboradores(id),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. TRIGGERS E FUNÇÕES
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_colaboradores_updated_at BEFORE UPDATE ON colaboradores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estabelecimentos_updated_at BEFORE UPDATE ON estabelecimentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_insumos_updated_at BEFORE UPDATE ON insumos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estoque_config_updated_at BEFORE UPDATE ON estoque_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_producao_updated_at BEFORE UPDATE ON producao FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_estoque_atual_updated_at BEFORE UPDATE ON estoque_atual FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventario_updated_at BEFORE UPDATE ON inventario FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventario_itens_updated_at BEFORE UPDATE ON inventario_itens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fichas_tecnicas_updated_at BEFORE UPDATE ON fichas_tecnicas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ordens_producao_updated_at BEFORE UPDATE ON ordens_producao FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. VIEWS ÚTEIS
-- =====================================================

-- View para estoque com informações completas
CREATE VIEW view_estoque_completo AS
SELECT 
    ea.id,
    i.nome as produto_nome,
    i.unidade,
    ea.quantidade,
    ea.local_armazenamento,
    ea.lote,
    ea.data_vencimento,
    ec.estoque_minimo,
    ec.estoque_medio,
    ec.estoque_maximo,
    CASE 
        WHEN ea.quantidade <= ec.estoque_minimo THEN 'CRÍTICO'
        WHEN ea.quantidade <= ec.estoque_medio THEN 'BAIXO'
        ELSE 'NORMAL'
    END as status_estoque,
    i.preco_compra,
    (ea.quantidade * i.preco_compra) as valor_total_estoque
FROM estoque_atual ea
JOIN insumos i ON ea.insumo_id = i.id
LEFT JOIN estoque_config ec ON i.id = ec.insumo_id
WHERE i.ativo = true;

-- View para produtividade por colaborador
CREATE VIEW view_produtividade_colaborador AS
SELECT 
    c.id as colaborador_id,
    c.nome as colaborador_nome,
    car.nome as cargo,
    DATE_TRUNC('month', p.data_producao) as mes_ano,
    SUM(CASE WHEN p.tipo_producao = 'peso' THEN p.quantidade ELSE 0 END) as total_peso_kg,
    SUM(CASE WHEN p.tipo_producao = 'peso' THEN p.valor_rs ELSE 0 END) as valor_peso_rs,
    SUM(CASE WHEN p.tipo_producao = 'unidade' THEN p.quantidade ELSE 0 END) as total_unidades,
    SUM(CASE WHEN p.tipo_producao = 'unidade' THEN p.valor_rs ELSE 0 END) as valor_unidades_rs,
    SUM(p.valor_rs) as valor_total_rs
FROM produtividade p
JOIN colaboradores c ON p.colaborador_id = c.id
JOIN cargos car ON c.cargo_id = car.id
GROUP BY c.id, c.nome, car.nome, DATE_TRUNC('month', p.data_producao);

-- View para histórico de pedidos
CREATE VIEW view_historico_pedidos AS
SELECT 
    p.id,
    p.data_pedido,
    p.hora_pedido,
    e.nome as estabelecimento,
    p.status,
    p.valor_total_custo,
    p.data_entrega_prevista,
    p.data_entrega_real,
    prof.name as criado_por,
    COUNT(pi.id) as total_itens
FROM pedidos p
JOIN estabelecimentos e ON p.estabelecimento_id = e.id
JOIN profiles prof ON p.quem_criou = prof.id
LEFT JOIN pedido_itens pi ON p.id = pi.pedido_id
GROUP BY p.id, e.nome, prof.name;

-- =====================================================
-- 10. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas principais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissoes_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtividade ENABLE ROW LEVEL SECURITY;

-- Política básica para profiles (usuários podem ver/editar próprio perfil)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Política para colaboradores (baseada em permissões)
CREATE POLICY "Colaboradores visibility" ON colaboradores FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM permissoes_modulo pm 
        WHERE pm.profile_id = auth.uid() 
        AND pm.modulo = 'admin' 
        AND pm.pode_visualizar = true
    )
);

-- =====================================================
-- 11. DADOS DE EXEMPLO (OPCIONAL)
-- =====================================================

-- Inserir estabelecimentos de exemplo
INSERT INTO estabelecimentos (nome, cnpj, endereco, telefone, prazo_entrega_dias, tipo_estabelecimento) VALUES
('Restaurante Bella Vista', '12.345.678/0001-90', 'Rua das Flores, 123', '(11) 1234-5678', 2, 'Restaurante'),
('Padaria São João', '98.765.432/0001-10', 'Av. Principal, 456', '(11) 9876-5432', 1, 'Padaria'),
('Hotel Cinco Estrelas', '11.222.333/0001-44', 'Rua Hoteleira, 789', '(11) 1111-2222', 3, 'Hotel');

-- Inserir insumos de exemplo
INSERT INTO insumos (nome, descricao, unidade, preco_compra, categoria) VALUES
('Farinha de Trigo', 'Farinha de trigo tipo 1', 'kg', 4.50, 'Farinhas'),
('Açúcar Cristal', 'Açúcar cristal refinado', 'kg', 3.20, 'Açúcares'),
('Ovos', 'Ovos de galinha grandes', 'un', 0.45, 'Proteínas'),
('Leite Integral', 'Leite integral pasteurizado', 'lt', 4.80, 'Laticínios'),
('Manteiga', 'Manteiga sem sal', 'kg', 18.90, 'Laticínios'),
('Fermento Biológico', 'Fermento fresco para pães', 'kg', 12.00, 'Fermentos'),
('Sal Refinado', 'Sal refinado iodado', 'kg', 2.10, 'Temperos');

-- Inserir configurações de estoque
INSERT INTO estoque_config (insumo_id, estoque_minimo, estoque_medio, estoque_maximo, local_armazenamento) VALUES
(1, 10.000, 25.000, 50.000, 'Estoque Seco'),
(2, 5.000, 15.000, 30.000, 'Estoque Seco'),
(3, 50, 100, 200, 'Geladeira'),
(4, 10.000, 20.000, 40.000, 'Geladeira'),
(5, 2.000, 5.000, 10.000, 'Geladeira'),
(6, 1.000, 3.000, 5.000, 'Geladeira'),
(7, 2.000, 5.000, 10.000, 'Estoque Seco');

-- Inserir estoque atual inicial
INSERT INTO estoque_atual (insumo_id, quantidade, local_armazenamento) VALUES
(1, 25.500, 'Estoque Seco'),
(2, 18.200, 'Estoque Seco'),
(3, 120, 'Geladeira'),
(4, 22.000, 'Geladeira'),
(5, 4.500, 'Geladeira'),
(6, 2.800, 'Geladeira'),
(7, 6.000, 'Estoque Seco');

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================