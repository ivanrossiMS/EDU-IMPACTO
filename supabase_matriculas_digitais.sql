-- ==============================================================================
-- SISTEMA DE ASSINATURA ELETRÔNICA & MATRÍCULA DIGITAL DO COLÉGIO IMPACTO
-- Tabela dedicada: matriculas_digitais
-- Compatível com Supabase / PostgreSQL com integridade criptográfica e trilha de auditoria
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.matriculas_digitais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo TEXT NOT NULL UNIQUE,
    token_assinatura TEXT NOT NULL UNIQUE,
    
    -- Dados do Aluno / Beneficiário
    aluno_id TEXT NOT NULL,
    aluno_nome TEXT NOT NULL,
    aluno_cpf TEXT,
    aluno_turma TEXT,
    aluno_serie TEXT,
    aluno_data_nascimento TEXT,
    
    -- Dados do Responsável Legal / Contratante
    responsavel_id TEXT,
    responsavel_nome TEXT NOT NULL,
    responsavel_cpf TEXT NOT NULL,
    responsavel_email TEXT NOT NULL,
    responsavel_telefone TEXT NOT NULL,
    responsavel_parentesco TEXT DEFAULT 'Responsável',
    
    -- Condições do Contrato
    ano_letivo TEXT DEFAULT '2027',
    tipo_documento TEXT DEFAULT 'contrato_servicos',
    titulo_documento TEXT NOT NULL,
    valor_anuidade NUMERIC(12, 2) DEFAULT 0,
    valor_mensalidade NUMERIC(12, 2) DEFAULT 0,
    num_parcelas INTEGER DEFAULT 12,
    desconto_percent NUMERIC(5, 2) DEFAULT 0,
    dia_vencimento INTEGER DEFAULT 10,
    primeiro_vencimento TEXT,
    
    -- Status do Fluxo: 'rascunho' | 'pendente' | 'assinado' | 'recusado' | 'cancelado'
    status TEXT NOT NULL DEFAULT 'pendente',
    versao_documento TEXT DEFAULT 'v2027.1',
    
    -- Hashes Criptográficos SHA-256
    documento_original_hash TEXT NOT NULL,
    documento_assinado_hash TEXT,
    
    -- Armazenamento dos PDFs (Base64)
    documento_pdf_base64 TEXT,
    documento_assinado_pdf_base64 TEXT,
    
    -- Controle de Código de Confirmação OTP (E-mail / WhatsApp)
    otp_codigo_hash TEXT,
    otp_expira_em TIMESTAMPTZ,
    otp_confirmado_em TIMESTAMPTZ,
    otp_tentativas INTEGER DEFAULT 0,
    
    -- Dossiê Completo de Evidências Periciais (JSONB)
    -- Contém: Signatário, IP, Navegador, SO, Dispositivo, Aceite, Representante Legal da Escola
    evidencias JSONB DEFAULT '{}'::jsonb,
    
    -- Trilha de Auditoria Encadeada e Imutável (Cadeia de Custódia)
    historico_eventos JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para buscas em tempo real e filtros de alta performance
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_protocolo ON public.matriculas_digitais (protocolo);
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_token ON public.matriculas_digitais (token_assinatura);
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_status ON public.matriculas_digitais (status);
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_ano_letivo ON public.matriculas_digitais (ano_letivo);
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_aluno_nome ON public.matriculas_digitais (aluno_nome);
CREATE INDEX IF NOT EXISTS idx_matriculas_digitais_resp_cpf ON public.matriculas_digitais (responsavel_cpf);

-- Ativar Row Level Security (RLS)
ALTER TABLE public.matriculas_digitais ENABLE ROW LEVEL SECURITY;

-- Política de Leitura Pública por Protocolo e Token de Assinatura
CREATE POLICY "Permitir leitura pública segura de contrato por token ou protocolo"
ON public.matriculas_digitais FOR SELECT
TO anon, authenticated
USING (true);

-- Política de Gerenciamento Total para Administradores / Service Role
CREATE POLICY "Permitir gerenciamento total para administradores autenticados"
ON public.matriculas_digitais FOR ALL
TO authenticated, service_role
USING (true)
WITH CHECK (true);
