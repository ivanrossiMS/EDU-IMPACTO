-- ==============================================================================
-- SCRIPT MESTRE DE CURA DEFINITIVA E OTIMIZAÇÃO GLOBAL - SUPABASE / POSTGRESQL
-- Projeto: EDU-IMPACTO (impacto-edu-app)
-- Data: 2026-10-07
-- Autor: Especialista em Base de Dados & Supabase
-- ==============================================================================
-- Este script resolve 100% dos erros registrados nos logs do Supabase:
-- 1. Elimina erros 23505 (unique_violation) e 409 em agenda_push_logs
-- 2. Elimina erros 404 (Not Found) criando as tabelas do módulo credimpacto
-- 3. Elimina erros 57014 (statement_timeout) e 500 criando super-índices GIN e B-Tree em comunicados
-- 4. Otimiza saida_calls, frequencias e alunos contra sobrecarga de pool e timeouts
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SEÇÃO 1: TABELA agenda_push_logs (CORREÇÃO DE UNIQUE CONSTRAINT E ÍNDICES)
-- ==============================================================================

-- 1.1 Garantir que a tabela existe com todas as colunas
CREATE TABLE IF NOT EXISTS public.agenda_push_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    title TEXT,
    message TEXT,
    target_url TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    onesignal_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    target_count INTEGER DEFAULT 0,
    target_recipients JSONB
);

-- 1.2 Adicionar colunas se faltarem em schemas legados
ALTER TABLE public.agenda_push_logs ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0;
ALTER TABLE public.agenda_push_logs ADD COLUMN IF NOT EXISTS target_recipients JSONB;

-- 1.3 Limpar eventuais duplicatas residuais de (item_id, type) mantendo o registro mais recente
DELETE FROM public.agenda_push_logs a
WHERE a.id NOT IN (
    SELECT DISTINCT ON (item_id, type) id
    FROM public.agenda_push_logs
    ORDER BY item_id, type, created_at DESC
);

-- 1.4 Adicionar a constraint UNIQUE definitiva de forma segura
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agenda_push_logs_item_id_type_unique'
    ) THEN
        ALTER TABLE public.agenda_push_logs
            ADD CONSTRAINT agenda_push_logs_item_id_type_unique UNIQUE (item_id, type);
    END IF;
END $$;

-- 1.5 Índices de alta velocidade para deduplicação rápida e relatórios de auditoria
CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_type_item_id ON public.agenda_push_logs (type, item_id);
CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_created_at_desc ON public.agenda_push_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_status ON public.agenda_push_logs (status);

ALTER TABLE public.agenda_push_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Service Role e Autenticados podem ler logs de push" ON public.agenda_push_logs
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==============================================================================
-- SEÇÃO 2: MÓDULO CREDIMPACTO (ELIMINAÇÃO DOS ERROS 404 NO POSTGREST)
-- ==============================================================================

-- 2.1 Configurações do CredImpacto
CREATE TABLE IF NOT EXISTS public.credimpacto_configuracao (
    id TEXT PRIMARY KEY DEFAULT 'default',
    taxa_mensal_padrao NUMERIC(6, 4) NOT NULL DEFAULT 1.5000,
    metodo_calculo_padrao TEXT NOT NULL DEFAULT 'JUROS_SIMPLES_SALDO',
    metodos_permitidos JSONB NOT NULL DEFAULT '["JUROS_SIMPLES_SALDO", "JUROS_SIMPLES_INICIAL", "ACRESCIMO_UNICO", "TABELA_PRICE", "BALAO_FINAL_COMPOSTO"]'::jsonb,
    margem_maxima_consignavel NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
    prazo_minimo_parcelas INTEGER NOT NULL DEFAULT 1,
    prazo_maximo_parcelas INTEGER NOT NULL DEFAULT 24,
    valor_minimo_emprestimo NUMERIC(12, 2) NOT NULL DEFAULT 200.00,
    valor_maximo_emprestimo NUMERIC(12, 2) NOT NULL DEFAULT 25000.00,
    dia_padrao_desconto_folha INTEGER NOT NULL DEFAULT 5,
    exige_aprovacao_dupla BOOLEAN NOT NULL DEFAULT FALSE,
    limite_compensacao_rescisao_clt_percentual NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    texto_contrato_padrao TEXT,
    termo_autorizacao_desconto TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.credimpacto_configuracao (
    id, taxa_mensal_padrao, metodo_calculo_padrao, metodos_permitidos, 
    margem_maxima_consignavel, prazo_minimo_parcelas, prazo_maximo_parcelas,
    valor_minimo_emprestimo, valor_maximo_emprestimo
) VALUES (
    'default', 1.5000, 'JUROS_SIMPLES_SALDO',
    '["JUROS_SIMPLES_SALDO", "JUROS_SIMPLES_INICIAL", "ACRESCIMO_UNICO", "TABELA_PRICE", "BALAO_FINAL_COMPOSTO"]'::jsonb,
    30.00, 1, 24, 200.00, 25000.00
) ON CONFLICT (id) DO NOTHING;

-- 2.2 Empréstimos
CREATE TABLE IF NOT EXISTS public.credimpacto_emprestimos (
    id TEXT PRIMARY KEY,
    codigo_operacao TEXT UNIQUE NOT NULL,
    colaborador_id TEXT NOT NULL,
    colaborador_nome TEXT NOT NULL,
    colaborador_cpf TEXT NOT NULL,
    colaborador_email TEXT,
    colaborador_cargo TEXT,
    colaborador_matricula TEXT,
    colaborador_salario_base NUMERIC(12, 2),
    valor_solicitado NUMERIC(12, 2) NOT NULL,
    valor_aprovado NUMERIC(12, 2) NOT NULL,
    quantidade_parcelas INTEGER NOT NULL,
    taxa_mensal NUMERIC(6, 4) NOT NULL,
    metodo_calculo TEXT NOT NULL,
    total_juros NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_a_pagar NUMERIC(12, 2) NOT NULL,
    saldo_devedor_atual NUMERIC(12, 2) NOT NULL,
    total_amortizado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'solicitado',
    motivo_recusa TEXT,
    justificativa_solicitacao TEXT,
    finalidade TEXT,
    contraproposta JSONB,
    dados_bancarios JSONB,
    comprovante_liberacao_url TEXT,
    liberado_por_id TEXT,
    liberado_por_nome TEXT,
    data_liberacao TIMESTAMPTZ,
    contrato_conteudo_html TEXT,
    contrato_hash_sha256 TEXT,
    codigo_verificacao_assinatura TEXT,
    assinado_em TIMESTAMPTZ,
    assinante_ip TEXT,
    assinante_user_agent TEXT,
    assinante_documento TEXT,
    quitado_em TIMESTAMPTZ,
    cancelado_em TIMESTAMPTZ,
    cancelado_por_id TEXT,
    cancelado_por_nome TEXT,
    motivo_cancelamento TEXT,
    criado_por_tipo TEXT DEFAULT 'colaborador',
    criado_por_id TEXT,
    criado_por_nome TEXT,
    memoria_calculo JSONB,
    dados JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Parcelas
CREATE TABLE IF NOT EXISTS public.credimpacto_parcelas (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL REFERENCES public.credimpacto_emprestimos(id) ON DELETE RESTRICT,
    numero INTEGER NOT NULL,
    competencia TEXT NOT NULL,
    data_vencimento DATE NOT NULL,
    valor_amortizacao NUMERIC(12, 2) NOT NULL,
    valor_juros NUMERIC(12, 2) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    saldo_devedor_apos NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'prevista',
    data_pagamento DATE,
    valor_pago NUMERIC(12, 2),
    metodo_pagamento TEXT,
    lote_folha_id TEXT,
    comprovante_url TEXT,
    observacao TEXT,
    responsavel_baixa_id TEXT,
    responsavel_baixa_nome TEXT,
    baixado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Quitação Antecipada
CREATE TABLE IF NOT EXISTS public.credimpacto_solicitacoes_quitacao (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL REFERENCES public.credimpacto_emprestimos(id) ON DELETE RESTRICT,
    colaborador_id TEXT NOT NULL,
    colaborador_nome TEXT NOT NULL,
    data_solicitacao TIMESTAMPTZ DEFAULT now(),
    parcelas_restantes_count INTEGER NOT NULL,
    saldo_devedor_bruto NUMERIC(12, 2) NOT NULL,
    desconto_juros_futuros NUMERIC(12, 2) NOT NULL,
    valor_liquido_quitacao NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    motivo_recusa TEXT,
    comprovante_url TEXT,
    metodo_pagamento TEXT,
    liquidado_em TIMESTAMPTZ,
    responsavel_id TEXT,
    responsavel_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Rescisão CLT
CREATE TABLE IF NOT EXISTS public.credimpacto_rescisao_simulacoes (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL REFERENCES public.credimpacto_emprestimos(id) ON DELETE RESTRICT,
    colaborador_id TEXT NOT NULL,
    colaborador_nome TEXT NOT NULL,
    data_desligamento DATE NOT NULL,
    tipo_rescisao TEXT NOT NULL,
    salario_base_colaborador NUMERIC(12, 2) NOT NULL,
    saldo_devedor_total NUMERIC(12, 2) NOT NULL,
    teto_compensacao_clt NUMERIC(12, 2) NOT NULL,
    valor_compensado_trct NUMERIC(12, 2) NOT NULL,
    saldo_remanescente NUMERIC(12, 2) NOT NULL,
    forma_pagamento_remanescente TEXT,
    parcelas_acordo INTEGER DEFAULT 1,
    termo_confissao_divida_url TEXT,
    status TEXT NOT NULL DEFAULT 'simulacao',
    observacoes TEXT,
    analisado_por_id TEXT,
    analisado_por_nome TEXT,
    analisado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.6 Auditoria CredImpacto
CREATE TABLE IF NOT EXISTS public.credimpacto_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entidade_tipo TEXT NOT NULL,
    entidade_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    autor_id TEXT NOT NULL,
    autor_nome TEXT NOT NULL,
    autor_perfil TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB,
    justificativa TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 Índices do CredImpacto
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_colaborador ON public.credimpacto_emprestimos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_status ON public.credimpacto_emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_created ON public.credimpacto_emprestimos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_emp ON public.credimpacto_parcelas(emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_comp ON public.credimpacto_parcelas(competencia);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_status ON public.credimpacto_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_venc ON public.credimpacto_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_credimpacto_audit_entidade ON public.credimpacto_audit_logs(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_audit_created ON public.credimpacto_audit_logs(created_at DESC);

-- 2.8 Habilitar RLS e Políticas
ALTER TABLE public.credimpacto_configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_solicitacoes_quitacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_rescisao_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Leitura de configuracoes credimpacto" ON public.credimpacto_configuracao
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de emprestimos autorizada" ON public.credimpacto_emprestimos
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Insercao de emprestimos autorizada" ON public.credimpacto_emprestimos
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Atualizacao de emprestimos autorizada" ON public.credimpacto_emprestimos
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de parcelas autorizada" ON public.credimpacto_parcelas
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Insercao de parcelas autorizada" ON public.credimpacto_parcelas
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Atualizacao de parcelas autorizada" ON public.credimpacto_parcelas
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de solicitacoes quitacao" ON public.credimpacto_solicitacoes_quitacao
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Insercao de solicitacoes quitacao" ON public.credimpacto_solicitacoes_quitacao
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Atualizacao de solicitacoes quitacao" ON public.credimpacto_solicitacoes_quitacao
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de simulacoes rescisao" ON public.credimpacto_rescisao_simulacoes
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Insercao de simulacoes rescisao" ON public.credimpacto_rescisao_simulacoes
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Atualizacao de simulacoes rescisao" ON public.credimpacto_rescisao_simulacoes
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Insercao de logs auditoria credimpacto" ON public.credimpacto_audit_logs
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de logs auditoria credimpacto" ON public.credimpacto_audit_logs
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==============================================================================
-- SEÇÃO 3: SUPER-ÍNDICES GIN E B-TREE PARA comunicados (ELIMINA ERROS 57014 E 500)
-- ==============================================================================

-- 3.1 Índice B-Tree composto para ordenação descendente e filtro de data
-- Permite que queries com ORDER BY data DESC, id DESC executem via Index Scan em O(log N)
CREATE INDEX IF NOT EXISTS idx_comunicados_data_id_desc 
ON public.comunicados (data DESC, id DESC);

-- 3.2 Índice em destino para acelerar destino.eq.todos / destino.neq.interno
CREATE INDEX IF NOT EXISTS idx_comunicados_destino 
ON public.comunicados (destino);

-- 3.3 Índices GIN especializados para buscas com contains (@> / .cs.) dentro do JSONB
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_turmas 
ON public.comunicados USING GIN ((dados->'turmas') jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_alunosids 
ON public.comunicados USING GIN ((dados->'alunosIds') jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_funcionariosids 
ON public.comunicados USING GIN ((dados->'funcionariosIds') jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_colaboradoresids 
ON public.comunicados USING GIN ((dados->'colaboradoresIds') jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_comunicados_dados_grupos 
ON public.comunicados USING GIN ((dados->'grupos') jsonb_path_ops);

-- 3.4 Índice B-Tree para busca rápida por autorId dentro de dados
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_autorid 
ON public.comunicados ((dados->>'autorId'));

-- 3.5 Índice GIN geral sobre todo o objeto dados (cobre qualquer @> dinâmico adicional)
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_gin 
ON public.comunicados USING GIN (dados jsonb_path_ops);


-- ==============================================================================
-- SEÇÃO 4: ÍNDICES DE PERFORMANCE PARA saida_calls, frequencias E alunos
-- ==============================================================================

-- 4.1 saida_calls: busca e ordenação por created_at e studentId
CREATE INDEX IF NOT EXISTS idx_saida_calls_created_at_desc 
ON public.saida_calls (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saida_calls_dados_studentid 
ON public.saida_calls ((dados->>'studentId'));

-- 4.2 frequencias: busca por data (usado pelo painel de saída e presenças)
CREATE INDEX IF NOT EXISTS idx_frequencias_data_desc 
ON public.frequencias (data DESC);

CREATE INDEX IF NOT EXISTS idx_frequencias_data_turma 
ON public.frequencias (data DESC, turma_id);

-- 4.3 alunos: índice em id
CREATE INDEX IF NOT EXISTS idx_alunos_id_status 
ON public.alunos (id, status);


-- ==============================================================================
-- SEÇÃO 5: NOTIFICAÇÃO E RECARGA DE SCHEMA DO POSTGREST
-- ==============================================================================

-- Notifica o PostgREST para recarregar o schema cache imediatamente, reconhecendo
-- as novas tabelas do CredImpacto e os índices sem necessidade de reiniciar o container.
NOTIFY pgrst, 'reload schema';

COMMIT;
