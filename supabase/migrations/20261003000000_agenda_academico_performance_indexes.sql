-- Migration: 20261003000000_agenda_academico_performance_indexes.sql
-- Descrição: Índices direcionados para aceleração de filtros e redução de I/O no Supabase.
-- Corrigido: Na tabela comunicados, a ordenação oficial é por 'data' e 'created_at', 
--            e 'status' está encapsulado na coluna JSONB 'dados'.

-- 1. Tabela comunicados: acelera ordenação e filtros de data da agenda
CREATE INDEX IF NOT EXISTS idx_comunicados_data_desc
  ON public.comunicados (data DESC);

CREATE INDEX IF NOT EXISTS idx_comunicados_created_at_desc
  ON public.comunicados (created_at DESC);

-- Opcional para filtros por status dentro do payload jsonb dados
CREATE INDEX IF NOT EXISTS idx_comunicados_status_dados
  ON public.comunicados ((dados->>'status'), created_at DESC);

-- 2. Tabela comunicados_respostas: acelera carregamento instantâneo do chat de comunicados
CREATE INDEX IF NOT EXISTS idx_comunicados_respostas_comunicado_created
  ON public.comunicados_respostas (comunicado_id, created_at ASC);

-- 3. Tabela momentos: acelera listagem do feed de fotos
CREATE INDEX IF NOT EXISTS idx_momentos_created_at_desc
  ON public.momentos (created_at DESC);

-- 4. Tabela frequencias: acelera buscas diárias de chamada por turma e por aluno
CREATE INDEX IF NOT EXISTS idx_frequencias_turma_data
  ON public.frequencias (turma_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_frequencias_aluno_data
  ON public.frequencias (aluno_id, data DESC);

-- 5. Tabela ocorrencias: acelera busca de ocorrências do aluno
CREATE INDEX IF NOT EXISTS idx_ocorrencias_aluno_created
  ON public.ocorrencias (aluno_id, created_at DESC);
