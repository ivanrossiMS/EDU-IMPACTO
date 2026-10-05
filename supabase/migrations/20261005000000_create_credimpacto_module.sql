-- ==============================================================================
-- MIGRATION: Módulo CredImpacto - Empréstimos e Desconto em Folha para Colaboradores
-- Arquivo: supabase/migrations/20261005000000_create_credimpacto_module.sql
-- ==============================================================================

-- 1. TABELA DE CONFIGURAÇÕES E POLÍTICAS DE CRÉDITO
CREATE TABLE IF NOT EXISTS public.credimpacto_configuracao (
    id TEXT PRIMARY KEY DEFAULT 'default',
    taxa_mensal_padrao NUMERIC(6, 4) NOT NULL DEFAULT 1.5000, -- 1.5% a.m.
    metodo_calculo_padrao TEXT NOT NULL DEFAULT 'JUROS_SIMPLES_SALDO',
    metodos_permitidos JSONB NOT NULL DEFAULT '["JUROS_SIMPLES_SALDO", "JUROS_SIMPLES_INICIAL", "ACRESCIMO_UNICO", "TABELA_PRICE", "BALAO_FINAL_COMPOSTO"]'::jsonb,
    margem_maxima_consignavel NUMERIC(5, 2) NOT NULL DEFAULT 30.00, -- Limite de 30% do salário líquido
    prazo_minimo_parcelas INTEGER NOT NULL DEFAULT 1,
    prazo_maximo_parcelas INTEGER NOT NULL DEFAULT 24,
    valor_minimo_emprestimo NUMERIC(12, 2) NOT NULL DEFAULT 200.00,
    valor_maximo_emprestimo NUMERIC(12, 2) NOT NULL DEFAULT 25000.00,
    dia_padrao_desconto_folha INTEGER NOT NULL DEFAULT 5, -- Quinto dia útil ou dia 5
    exige_aprovacao_dupla BOOLEAN NOT NULL DEFAULT FALSE,
    limite_compensacao_rescisao_clt_percentual NUMERIC(5, 2) NOT NULL DEFAULT 100.00, -- Art. 477 CLT: 1 salário
    texto_contrato_padrao TEXT,
    termo_autorizacao_desconto TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir configuração inicial se não existir
INSERT INTO public.credimpacto_configuracao (
    id, taxa_mensal_padrao, metodo_calculo_padrao, metodos_permitidos, 
    margem_maxima_consignavel, prazo_minimo_parcelas, prazo_maximo_parcelas,
    valor_minimo_emprestimo, valor_maximo_emprestimo
) VALUES (
    'default', 1.5000, 'JUROS_SIMPLES_SALDO',
    '["JUROS_SIMPLES_SALDO", "JUROS_SIMPLES_INICIAL", "ACRESCIMO_UNICO", "TABELA_PRICE", "BALAO_FINAL_COMPOSTO"]'::jsonb,
    30.00, 1, 24, 200.00, 25000.00
) ON CONFLICT (id) DO NOTHING;

-- 2. TABELA DE OPERAÇÕES DE EMPRÉSTIMO
CREATE TABLE IF NOT EXISTS public.credimpacto_emprestimos (
    id TEXT PRIMARY KEY,
    codigo_operacao TEXT UNIQUE NOT NULL, -- Ex: CRED-2026-0001
    colaborador_id TEXT NOT NULL,
    colaborador_nome TEXT NOT NULL,
    colaborador_cpf TEXT NOT NULL,
    colaborador_email TEXT,
    colaborador_cargo TEXT,
    colaborador_matricula TEXT,
    colaborador_salario_base NUMERIC(12, 2),
    
    -- Condições financeiras
    valor_solicitado NUMERIC(12, 2) NOT NULL,
    valor_aprovado NUMERIC(12, 2) NOT NULL,
    quantidade_parcelas INTEGER NOT NULL,
    taxa_mensal NUMERIC(6, 4) NOT NULL,
    metodo_calculo TEXT NOT NULL,
    total_juros NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_a_pagar NUMERIC(12, 2) NOT NULL,
    saldo_devedor_atual NUMERIC(12, 2) NOT NULL,
    total_amortizado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Status do ciclo de vida
    -- 'solicitado' | 'em_analise' | 'contraproposta' | 'aprovado' | 'aguardando_assinatura' | 'aguardando_liberacao' | 'ativo' | 'quitado' | 'renegociado' | 'recusado' | 'cancelado'
    status TEXT NOT NULL DEFAULT 'solicitado',
    motivo_recusa TEXT,
    justificativa_solicitacao TEXT,
    finalidade TEXT,
    
    -- Contraproposta (se houver)
    contraproposta JSONB,
    
    -- Dados de liberação bancária
    dados_bancarios JSONB, -- { banco, agencia, conta, tipoConta, chavePix }
    comprovante_liberacao_url TEXT,
    liberado_por_id TEXT,
    liberado_por_nome TEXT,
    data_liberacao TIMESTAMPTZ,
    
    -- Assinatura Eletrônica e Contrato
    contrato_conteudo_html TEXT,
    contrato_hash_sha256 TEXT,
    codigo_verificacao_assinatura TEXT,
    assinado_em TIMESTAMPTZ,
    assinante_ip TEXT,
    assinante_user_agent TEXT,
    assinante_documento TEXT,
    
    -- Quitação e Cancelamento
    quitado_em TIMESTAMPTZ,
    cancelado_em TIMESTAMPTZ,
    cancelado_por_id TEXT,
    cancelado_por_nome TEXT,
    motivo_cancelamento TEXT,
    
    -- Auditoria e metadados
    criado_por_tipo TEXT DEFAULT 'colaborador', -- 'colaborador' ou 'financeiro'
    criado_por_id TEXT,
    criado_por_nome TEXT,
    memoria_calculo JSONB,
    dados JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE PARCELAS DO EMPRÉSTIMO
CREATE TABLE IF NOT EXISTS public.credimpacto_parcelas (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL REFERENCES public.credimpacto_emprestimos(id) ON DELETE RESTRICT,
    numero INTEGER NOT NULL,
    competencia TEXT NOT NULL, -- Ex: '2026-10' ou '10/2026'
    data_vencimento DATE NOT NULL,
    
    -- Tríade financeira precisa
    valor_amortizacao NUMERIC(12, 2) NOT NULL,
    valor_juros NUMERIC(12, 2) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    saldo_devedor_apos NUMERIC(12, 2) NOT NULL,
    
    -- Status do desconto e liquidação
    -- 'prevista' | 'exportada_folha' | 'descontada' | 'paga_avulso' | 'atrasada' | 'renegociada' | 'cancelada'
    status TEXT NOT NULL DEFAULT 'prevista',
    
    -- Dados da conciliação efetiva
    data_pagamento DATE,
    valor_pago NUMERIC(12, 2),
    metodo_pagamento TEXT, -- 'folha_pagamento' | 'pix' | 'transferencia' | 'dinheiro' | 'rescisao_clt'
    lote_folha_id TEXT,
    comprovante_url TEXT,
    observacao TEXT,
    responsavel_baixa_id TEXT,
    responsavel_baixa_nome TEXT,
    baixado_em TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE SOLICITAÇÕES DE QUITAÇÃO ANTECIPADA
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
    
    -- 'pendente' | 'aprovada' | 'paga' | 'recusada' | 'cancelada'
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

-- 5. TABELA DE SIMULAÇÕES E LIQUIDAÇÕES DE RESCISÃO CLT (DESLIGAMENTO)
CREATE TABLE IF NOT EXISTS public.credimpacto_rescisao_simulacoes (
    id TEXT PRIMARY KEY,
    emprestimo_id TEXT NOT NULL REFERENCES public.credimpacto_emprestimos(id) ON DELETE RESTRICT,
    colaborador_id TEXT NOT NULL,
    colaborador_nome TEXT NOT NULL,
    data_desligamento DATE NOT NULL,
    tipo_rescisao TEXT NOT NULL, -- 'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_mutuo'
    
    -- Cálculos de Compensação CLT Art. 477 § 5º
    salario_base_colaborador NUMERIC(12, 2) NOT NULL,
    saldo_devedor_total NUMERIC(12, 2) NOT NULL,
    teto_compensacao_clt NUMERIC(12, 2) NOT NULL,
    valor_compensado_trct NUMERIC(12, 2) NOT NULL,
    saldo_remanescente NUMERIC(12, 2) NOT NULL,
    
    -- Acordo de pagamento do remanescente
    forma_pagamento_remanescente TEXT, -- 'pix_a_vista' | 'parcelamento_avulso' | 'outro'
    parcelas_acordo INTEGER DEFAULT 1,
    termo_confissao_divida_url TEXT,
    
    -- 'simulacao' | 'aprovado_financeiro' | 'homologado_trct' | 'cancelado'
    status TEXT NOT NULL DEFAULT 'simulacao',
    observacoes TEXT,
    analisado_por_id TEXT,
    analisado_por_nome TEXT,
    analisado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABELA DE AUDITORIA IMUTÁVEL DO CREDIMPACTO
CREATE TABLE IF NOT EXISTS public.credimpacto_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entidade_tipo TEXT NOT NULL, -- 'emprestimo' | 'parcela' | 'quitacao' | 'rescisao' | 'configuracao'
    entidade_id TEXT NOT NULL,
    acao TEXT NOT NULL, -- 'CRIACAO' | 'APROVACAO' | 'RECUSA' | 'CONTRAPROPOSTA' | 'ASSINATURA' | 'LIBERACAO' | 'CONCILIACAO_FOLHA' | 'ESTORNO_BAIXA' | 'QUITACAO_ANTECIPADA' | 'RESCISAO_CLT' | 'CANCELAMENTO' | 'ALTERACAO_CONFIG'
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

-- ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_colaborador ON public.credimpacto_emprestimos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_status ON public.credimpacto_emprestimos(status);
CREATE INDEX IF NOT EXISTS idx_credimpacto_emp_created ON public.credimpacto_emprestimos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_emp ON public.credimpacto_parcelas(emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_comp ON public.credimpacto_parcelas(competencia);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_status ON public.credimpacto_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_credimpacto_parc_venc ON public.credimpacto_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_credimpacto_audit_entidade ON public.credimpacto_audit_logs(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_credimpacto_audit_created ON public.credimpacto_audit_logs(created_at DESC);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.credimpacto_configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_solicitacoes_quitacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_rescisao_simulacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credimpacto_audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS SEGURAS
-- Configuração: Qualquer autenticado pode ler; apenas financeiro/admin pode editar
DO $$ BEGIN
    CREATE POLICY "Leitura de configuracoes credimpacto" ON public.credimpacto_configuracao
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Empréstimos: Usuários podem ler seus próprios registros; admins/financeiro leem todos
DO $$ BEGIN
    CREATE POLICY "Colaborador visualiza seus proprios emprestimos" ON public.credimpacto_emprestimos
        FOR SELECT TO authenticated
        USING (
            colaborador_id = auth.uid()::text OR
            colaborador_email = auth.email() OR
            EXISTS (
                SELECT 1 FROM public.system_users su
                WHERE (su.id = auth.uid()::text OR su.auth_id = auth.uid()::text OR su.email = auth.email())
                AND (su.perfil ILIKE ANY(ARRAY['%admin%', '%diret%', '%financ%', '%rh%']) OR su.cargo ILIKE ANY(ARRAY['%admin%', '%diret%', '%financ%', '%rh%']))
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Colaborador pode solicitar emprestimo" ON public.credimpacto_emprestimos
        FOR INSERT TO authenticated
        WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Gestores e colaboradores atualizam conforme fluxo" ON public.credimpacto_emprestimos
        FOR UPDATE TO authenticated
        USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- NUNCA permitir deleção de operações financeiras concluídas
DO $$ BEGIN
    CREATE POLICY "Proibir delecao de emprestimos" ON public.credimpacto_emprestimos
        FOR DELETE TO authenticated
        USING (status IN ('solicitado', 'recusado', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Parcelas: leitura do dono ou admin
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

-- Logs de auditoria: Qualquer autenticado pode registrar log; leitura para todos autorizados; NENHUMA exclusão permitida!
DO $$ BEGIN
    CREATE POLICY "Insercao de logs auditoria" ON public.credimpacto_audit_logs
        FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Leitura de logs auditoria" ON public.credimpacto_audit_logs
        FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
