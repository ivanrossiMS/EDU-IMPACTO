-- Migration: 20260915184500_saida_performance_indexes.sql
-- Descrição: Índices críticos para otimização de performance do módulo de Saída de Alunos,
--            Painel Tablet e Monitor TV.

-- 1. Extensão pg_trgm (garantir ativação para buscas ilike em nomes)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- 2. Índices na tabela saida_calls
-- Acelera listagem diária por data (order by created_at desc e filtros gte/lte)
CREATE INDEX IF NOT EXISTS idx_saida_calls_created_at
  ON public.saida_calls (created_at DESC);

-- Acelera busca de chamadas por aluno (studentId dentro do jsonb dados)
CREATE INDEX IF NOT EXISTS idx_saida_calls_student_id
  ON public.saida_calls ((dados->>'studentId'));

-- Acelera verificação composta: "este aluno já foi chamado/retirado hoje?"
CREATE INDEX IF NOT EXISTS idx_saida_calls_student_created
  ON public.saida_calls ((dados->>'studentId'), created_at DESC);

-- Acelera filtros por status da chamada (waiting, called, confirmed, cancelled)
CREATE INDEX IF NOT EXISTS idx_saida_calls_status
  ON public.saida_calls ((dados->>'status'));

-- Acelera busca composta de chamadas ativas do dia
CREATE INDEX IF NOT EXISTS idx_saida_calls_status_created
  ON public.saida_calls ((dados->>'status'), created_at DESC);

-- 3. Índices na tabela responsaveis
-- Acelera busca de responsáveis por nome (utilizado na resolução de irmãos e vínculos)
CREATE INDEX IF NOT EXISTS idx_responsaveis_nome_trgm
  ON public.responsaveis USING gin (nome gin_trgm_ops);

-- Acelera leitura de cartões RFID no Painel Tablet e Portaria
CREATE INDEX IF NOT EXISTS idx_responsaveis_rfid
  ON public.responsaveis (rfid)
  WHERE rfid IS NOT NULL AND rfid != '';

-- Acelera checagem de responsáveis bloqueados/proibidos
CREATE INDEX IF NOT EXISTS idx_responsaveis_proibido
  ON public.responsaveis (proibido)
  WHERE proibido = true;

-- 4. Índice na tabela frequencias para saídas registradas no diário
CREATE INDEX IF NOT EXISTS idx_frequencias_data
  ON public.frequencias (data);

CREATE INDEX IF NOT EXISTS idx_frequencias_saida_horario
  ON public.frequencias ((dados->>'saidaHorario'))
  WHERE dados->>'saidaHorario' IS NOT NULL;

-- 5. Garantir que a tabela saida_calls está publicada no Realtime do Supabase
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'saida_calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.saida_calls;
    END IF;
END $$;
