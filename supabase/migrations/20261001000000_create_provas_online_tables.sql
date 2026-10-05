-- ============================================================================
-- MIGRATION: Módulo Provas Online - IMPACTO-EDU
-- ============================================================================

-- 1. Tabela: provas_online
CREATE TABLE IF NOT EXISTS public.provas_online (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    disciplina TEXT NOT NULL,
    turmas TEXT[] NOT NULL DEFAULT '{}',
    series TEXT[] NOT NULL DEFAULT '{}',
    ano_letivo INTEGER NOT NULL DEFAULT 2026,
    bimestre INTEGER NOT NULL DEFAULT 1,
    finalidade TEXT NOT NULL DEFAULT 'avaliacao',
    professor_id TEXT NOT NULL,
    professor_nome TEXT NOT NULL,
    instrucoes TEXT,
    materiais_permitidos TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho',
    aprovacao_requerida BOOLEAN DEFAULT false,
    status_aprovacao TEXT DEFAULT 'aprovada',
    aprovado_por TEXT,
    data_aprovacao TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    valor_total NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    quantidade_tentativas INTEGER NOT NULL DEFAULT 1,
    politica_tentativas TEXT NOT NULL DEFAULT 'maior_nota',
    data_abertura TIMESTAMPTZ NOT NULL,
    data_limite_inicio TIMESTAMPTZ,
    data_encerramento TIMESTAMPTZ NOT NULL,
    duracao_minutos INTEGER NOT NULL DEFAULT 60,
    codigo_liberacao TEXT,
    configuracao_layout JSONB NOT NULL DEFAULT '{"questaoPorPagina": true, "navegacaoLivre": true, "permitirVoltar": true, "embaralharQuestoes": false, "embaralharAlternativas": false}',
    configuracao_monitoramento JSONB NOT NULL DEFAULT '{"solicitarTelaCheia": false, "registrarSaidaTela": true, "bloquearColar": true, "acaoOcorrencia": "suspender"}',
    configuracao_divulgacao JSONB NOT NULL DEFAULT '{"liberarGabarito": "apos_encerramento", "liberarNota": "apos_correcao", "liberarComentarios": true}',
    alunos_especificos TEXT[],
    integracao_notas JSONB DEFAULT '{"lancado": false}',
    publicado_em TIMESTAMPTZ,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela: provas_online_questoes
CREATE TABLE IF NOT EXISTS public.provas_online_questoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prova_id UUID NOT NULL REFERENCES public.provas_online(id) ON DELETE CASCADE,
    banco_questao_id UUID,
    ordem INTEGER NOT NULL DEFAULT 0,
    tipo TEXT NOT NULL DEFAULT 'multipla_escolha',
    enunciado TEXT NOT NULL,
    pontuacao NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    alternativas JSONB,
    itens_vf JSONB,
    config_pontuacao_parcial JSONB,
    resposta_esperada TEXT,
    criterios_avaliacao JSONB,
    limite_palavras INTEGER,
    permite_anexo_resolucao BOOLEAN DEFAULT false,
    explicacao_resposta TEXT,
    anulada BOOLEAN DEFAULT false,
    motivo_anulacao TEXT,
    politica_anulacao TEXT,
    tags TEXT[],
    habilidade_bncc TEXT,
    dificuldade TEXT DEFAULT 'media',
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: provas_online_banco
CREATE TABLE IF NOT EXISTS public.provas_online_banco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disciplina TEXT NOT NULL,
    serie TEXT NOT NULL,
    assunto TEXT NOT NULL,
    habilidade_bncc TEXT,
    nivel_dificuldade TEXT NOT NULL DEFAULT 'media',
    tipo TEXT NOT NULL DEFAULT 'multipla_escolha',
    enunciado TEXT NOT NULL,
    pontuacao_sugerida NUMERIC(5,2) DEFAULT 1.00,
    alternativas JSONB,
    itens_vf JSONB,
    config_pontuacao_parcial JSONB,
    resposta_esperada TEXT,
    criterios_avaliacao JSONB,
    limite_palavras INTEGER,
    permite_anexo_resolucao BOOLEAN DEFAULT false,
    explicacao_resposta TEXT,
    tags TEXT[],
    criado_por TEXT,
    ativo BOOLEAN DEFAULT true,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: provas_online_tentativas
CREATE TABLE IF NOT EXISTS public.provas_online_tentativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prova_id UUID NOT NULL REFERENCES public.provas_online(id) ON DELETE CASCADE,
    aluno_id TEXT NOT NULL,
    aluno_nome TEXT NOT NULL,
    aluno_matricula TEXT,
    turma_id TEXT NOT NULL,
    numero_tentativa INTEGER NOT NULL DEFAULT 1,
    session_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'em_andamento',
    iniciada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    prazo_limite TIMESTAMPTZ NOT NULL,
    tempo_adicional_minutos INTEGER DEFAULT 0,
    motivo_tempo_adicional TEXT,
    autorizado_por TEXT,
    entregue_em TIMESTAMPTZ,
    ultima_atividade TIMESTAMPTZ DEFAULT NOW(),
    ordem_questoes JSONB NOT NULL DEFAULT '[]',
    respostas JSONB NOT NULL DEFAULT '{}',
    versao_respostas INTEGER NOT NULL DEFAULT 0,
    pontuacao_objetiva NUMERIC(5,2) DEFAULT 0.00,
    pontuacao_dissertativa NUMERIC(5,2) DEFAULT 0.00,
    nota_final NUMERIC(5,2) DEFAULT 0.00,
    status_correcao TEXT DEFAULT 'pendente',
    comprovante_codigo TEXT NOT NULL,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela: provas_online_ocorrencias
CREATE TABLE IF NOT EXISTS public.provas_online_ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tentativa_id UUID NOT NULL REFERENCES public.provas_online_tentativas(id) ON DELETE CASCADE,
    aluno_id TEXT NOT NULL,
    aluno_nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    duracao_segundos INTEGER,
    detalhes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela: provas_online_mensagens
CREATE TABLE IF NOT EXISTS public.provas_online_mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prova_id UUID NOT NULL REFERENCES public.provas_online(id) ON DELETE CASCADE,
    tentativa_id UUID REFERENCES public.provas_online_tentativas(id) ON DELETE CASCADE,
    remetente_id TEXT NOT NULL,
    remetente_nome TEXT NOT NULL,
    remetente_cargo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'geral',
    lida BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela: provas_online_excecoes
CREATE TABLE IF NOT EXISTS public.provas_online_excecoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prova_id UUID NOT NULL REFERENCES public.provas_online(id) ON DELETE CASCADE,
    aluno_id TEXT NOT NULL,
    tipo_excecao TEXT NOT NULL,
    minutos_adicionais INTEGER,
    justificativa TEXT NOT NULL,
    autorizado_por TEXT NOT NULL,
    dados JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes de alta performance
CREATE INDEX IF NOT EXISTS idx_provas_online_status ON public.provas_online(status);
CREATE INDEX IF NOT EXISTS idx_provas_online_datas ON public.provas_online(data_abertura, data_encerramento);
CREATE INDEX IF NOT EXISTS idx_provas_online_prof ON public.provas_online(professor_id);
CREATE INDEX IF NOT EXISTS idx_provas_online_tentativas_prova_aluno ON public.provas_online_tentativas(prova_id, aluno_id);
CREATE INDEX IF NOT EXISTS idx_provas_online_tentativas_status ON public.provas_online_tentativas(status);
CREATE INDEX IF NOT EXISTS idx_provas_online_ocorrencias_tentativa ON public.provas_online_ocorrencias(tentativa_id);
CREATE INDEX IF NOT EXISTS idx_provas_online_banco_disciplina ON public.provas_online_banco(disciplina, nivel_dificuldade);

-- RLS
ALTER TABLE public.provas_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_online_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for provas_online" ON public.provas_online FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_questoes" ON public.provas_online_questoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_banco" ON public.provas_online_banco FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_tentativas" ON public.provas_online_tentativas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_ocorrencias" ON public.provas_online_ocorrencias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_mensagens" ON public.provas_online_mensagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for provas_online_excecoes" ON public.provas_online_excecoes FOR ALL USING (true) WITH CHECK (true);
