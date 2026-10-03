-- Migration: Autorizações Financeiras na Agenda Digital
-- Permite que o responsável financeiro titular autorize outro responsável a acessar a área financeira dos alunos.

CREATE TABLE IF NOT EXISTS public.autorizacoes_financeiras_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id TEXT NOT NULL,
  aluno_nome TEXT,
  responsavel_autorizado_id TEXT NOT NULL,
  responsavel_autorizado_nome TEXT,
  responsavel_concessor_id TEXT NOT NULL,
  responsavel_concessor_nome TEXT,
  responsavel_concessor_email TEXT,
  acao TEXT NOT NULL, -- 'AUTORIZAR' | 'REVOGAR'
  motivo TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_aut_fin_aluno ON public.autorizacoes_financeiras_logs (aluno_id);
CREATE INDEX IF NOT EXISTS idx_aut_fin_resp_aut ON public.autorizacoes_financeiras_logs (responsavel_autorizado_id);
CREATE INDEX IF NOT EXISTS idx_aut_fin_resp_conc ON public.autorizacoes_financeiras_logs (responsavel_concessor_id);
CREATE INDEX IF NOT EXISTS idx_aut_fin_created_at ON public.autorizacoes_financeiras_logs (created_at DESC);

-- RLS
ALTER TABLE public.autorizacoes_financeiras_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'autorizacoes_financeiras_logs' 
    AND policyname = 'Permitir leitura de autorizações financeiras para autenticados'
  ) THEN
    CREATE POLICY "Permitir leitura de autorizações financeiras para autenticados" 
      ON public.autorizacoes_financeiras_logs
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'autorizacoes_financeiras_logs' 
    AND policyname = 'Permitir inserção de autorizações financeiras para autenticados'
  ) THEN
    CREATE POLICY "Permitir inserção de autorizações financeiras para autenticados" 
      ON public.autorizacoes_financeiras_logs
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
