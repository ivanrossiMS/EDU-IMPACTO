-- ============================================================
-- DRE (Demonstração do Resultado do Exercício) — Supabase SQL
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Criar tabela para armazenar os DREs processados
CREATE TABLE IF NOT EXISTS public.dre_uploads (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_arquivo      TEXT NOT NULL,
  tipo_arquivo      TEXT CHECK (tipo_arquivo IN ('pdf', 'xlsx')) DEFAULT 'xlsx',
  periodo_descricao TEXT,
  periodo_inicio    DATE,
  periodo_fim       DATE,
  empresa           TEXT,
  dados_dre         JSONB NOT NULL,          -- DRE completo processado pela IA
  total_receitas    NUMERIC(15,2) DEFAULT 0,
  total_despesas    NUMERIC(15,2) DEFAULT 0,
  resultado_liquido NUMERIC(15,2) DEFAULT 0,
  criado_por        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dre_uploads_criado_em   ON public.dre_uploads (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_dre_uploads_criado_por  ON public.dre_uploads (criado_por);
CREATE INDEX IF NOT EXISTS idx_dre_uploads_periodo     ON public.dre_uploads (periodo_inicio, periodo_fim);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.dre_uploads ENABLE ROW LEVEL SECURITY;

-- Política: admin e diretores podem ver todos os DREs
CREATE POLICY "dre_select_admin" ON public.dre_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.user_id = auth.uid()
      AND u.role IN ('admin', 'super_admin', 'diretor', 'financeiro')
    )
  );

-- Política: qualquer usuário autenticado com role adequada pode inserir
CREATE POLICY "dre_insert_admin" ON public.dre_uploads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.user_id = auth.uid()
      AND u.role IN ('admin', 'super_admin', 'diretor', 'financeiro')
    )
  );

-- Política: só quem criou ou admins podem deletar
CREATE POLICY "dre_delete_admin" ON public.dre_uploads
  FOR DELETE
  USING (
    criado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.user_id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
    )
  );

-- Habilitar realtime (opcional mas útil)
ALTER PUBLICATION supabase_realtime ADD TABLE public.dre_uploads;

-- Verificar criação
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'dre_uploads'
ORDER BY ordinal_position;
