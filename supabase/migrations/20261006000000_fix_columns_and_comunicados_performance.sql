-- Migration: 20261006000000_fix_columns_and_comunicados_performance.sql
-- Descrição: 
-- 1. Garante que as colunas 'destinatario_id' em comunicados_respostas e 'tempos' em frequencias existam no schema
-- 2. Cria índices GIN e B-Tree vitais para eliminar statement timeout na busca de comunicados da agenda

-- 1. Tabela comunicados_respostas: adiciona destinatario_id para suporte a conversas direcionadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comunicados_respostas' AND column_name = 'destinatario_id'
  ) THEN
    ALTER TABLE public.comunicados_respostas ADD COLUMN destinatario_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comunicados_respostas_destinatario
  ON public.comunicados_respostas(destinatario_id);

-- 2. Tabela frequencias: adiciona tempos (jsonb) para compatibilidade estrutural
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'frequencias' AND column_name = 'tempos'
  ) THEN
    ALTER TABLE public.frequencias ADD COLUMN tempos jsonb DEFAULT NULL;
  END IF;
END $$;

-- 3. Aceleração de busca em comunicados (elimina timeouts do Postgres / 500 / 521 / 522):
-- Índice GIN sobre o payload JSONB 'dados' (acelera filtros @> / .cs.["..."] de turmas, alunosIds e grupos)
CREATE INDEX IF NOT EXISTS idx_comunicados_dados_gin 
  ON public.comunicados USING gin (dados);

-- Índice no campo destino (acelera filtro destino = 'todos')
CREATE INDEX IF NOT EXISTS idx_comunicados_destino 
  ON public.comunicados (destino);
