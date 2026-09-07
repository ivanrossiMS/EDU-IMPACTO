-- ================================================================
-- IMPACTO EDU — Tabela: matriculas_contratos (Matrículas Online & ZapSign)
-- Execute no painel SQL do Supabase
-- ================================================================

CREATE TABLE IF NOT EXISTS public.matriculas_contratos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id            text NOT NULL,
  aluno_nome          text NOT NULL,
  aluno_cpf           text,
  aluno_turma         text,
  aluno_serie         text,
  responsavel_id      text,
  responsavel_nome    text NOT NULL,
  responsavel_cpf     text NOT NULL,
  responsavel_email   text,
  responsavel_telefone text,
  responsavel_parentesco text,
  
  -- Informações Acadêmicas e Financeiras
  ano_letivo          text NOT NULL DEFAULT '2027',
  tipo_documento      text NOT NULL DEFAULT 'contrato_servicos', -- 'contrato_servicos', 'requerimento_matricula', 'pacote_completo'
  valor_anuidade      numeric(12, 2) DEFAULT 0,
  valor_mensalidade   numeric(12, 2) DEFAULT 0,
  num_parcelas        integer DEFAULT 12,
  desconto_percent    numeric(5, 2) DEFAULT 0,
  dia_vencimento      integer DEFAULT 10,
  
  -- Integração ZapSign
  zapsign_doc_token    text,
  zapsign_signer_token text,
  zapsign_sign_url     text,
  zapsign_auth_mode    text DEFAULT 'tokenWhatsapp', -- 'tokenWhatsapp', 'tokenEmail', 'assinaturaTela'
  zapsign_status       text DEFAULT 'novo', -- 'novo', 'pending', 'signed', 'refused', 'canceled'
  
  -- Status interno do contrato
  status              text NOT NULL DEFAULT 'aguardando', -- 'rascunho', 'enviado', 'aguardando', 'assinado', 'recusado', 'cancelado'
  
  -- Arquivos e URLs
  pdf_base64_hash     text,
  original_file_url   text,
  signed_file_url     text,
  
  -- Metadados gerais (dados cadastrais consolidados, logs, etc.)
  metadata            jsonb DEFAULT '{}'::jsonb,
  
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_matriculas_contratos_aluno_id ON public.matriculas_contratos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_contratos_status ON public.matriculas_contratos(status);
CREATE INDEX IF NOT EXISTS idx_matriculas_contratos_ano ON public.matriculas_contratos(ano_letivo);
CREATE INDEX IF NOT EXISTS idx_matriculas_contratos_zapsign_token ON public.matriculas_contratos(zapsign_doc_token);
CREATE INDEX IF NOT EXISTS idx_matriculas_contratos_created_at ON public.matriculas_contratos(created_at DESC);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_matriculas_contratos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_matriculas_contratos_updated_at ON public.matriculas_contratos;
CREATE TRIGGER trigger_matriculas_contratos_updated_at
  BEFORE UPDATE ON public.matriculas_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_matriculas_contratos_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.matriculas_contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matriculas_contratos_auth" ON public.matriculas_contratos;
CREATE POLICY "matriculas_contratos_auth" ON public.matriculas_contratos
  FOR ALL USING (auth.role() = 'authenticated');
