-- Criação da tabela de Pesquisas de Clima (Campanhas)
CREATE TABLE IF NOT EXISTS gp_pesquisas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(100) DEFAULT 'eNPS',
    data_fim DATE NOT NULL,
    perguntas JSONB DEFAULT '[]'::jsonb, -- Array de objetos com as configurações de cada pergunta
    status VARCHAR(50) DEFAULT 'ativa',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Se a tabela já existir e precisarmos adicionar a nova coluna JSONB
ALTER TABLE gp_pesquisas ADD COLUMN IF NOT EXISTS perguntas JSONB DEFAULT '[]'::jsonb;

-- Criação da tabela de Respostas da Pesquisa
CREATE TABLE IF NOT EXISTS gp_pesquisa_respostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pesquisa_id UUID REFERENCES gp_pesquisas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL, -- ID de quem respondeu (auth.users ou system_users)
    usuario_nome VARCHAR(255),
    usuario_cargo VARCHAR(255),
    
    -- Para retrocompatibilidade mantemos nota e comentario como nulos
    nota INTEGER CHECK (nota >= 0 AND nota <= 10),
    comentario TEXT,
    
    -- Novo campo dinâmico
    respostas_json JSONB DEFAULT '{}'::jsonb, -- Mapa chave/valor de respostas
    
    ip_assinatura VARCHAR(50),
    data_assinatura TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_resposta_usuario UNIQUE (pesquisa_id, usuario_id) -- Uma pessoa só responde uma vez por pesquisa
);

-- Se a tabela já existir, alterar para remover a obrigatoriedade da NOTA e adicionar respostas_json
ALTER TABLE gp_pesquisa_respostas ALTER COLUMN nota DROP NOT NULL;
ALTER TABLE gp_pesquisa_respostas ADD COLUMN IF NOT EXISTS respostas_json JSONB DEFAULT '{}'::jsonb;

-- Habilitar RLS
ALTER TABLE gp_pesquisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gp_pesquisa_respostas ENABLE ROW LEVEL SECURITY;

-- Permitir acesso total a usuarios autenticados
CREATE POLICY "Permitir leitura para todos autenticados" ON gp_pesquisas FOR SELECT USING (true);
CREATE POLICY "Permitir escrita para todos autenticados" ON gp_pesquisas FOR ALL USING (true);

CREATE POLICY "Permitir leitura de respostas" ON gp_pesquisa_respostas FOR SELECT USING (true);
CREATE POLICY "Permitir inserção de respostas" ON gp_pesquisa_respostas FOR INSERT WITH CHECK (true);

-- Notificar PostgREST para recarregar o cache (importante)
NOTIFY pgrst, 'reload schema';
