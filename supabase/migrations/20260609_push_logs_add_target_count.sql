-- Migração: Adicionar coluna target_count à tabela agenda_push_logs
-- Registra quantos destinatários foram alvejados em cada disparo de push.
-- Essencial para métricas e diagnóstico no painel administrativo.

ALTER TABLE public.agenda_push_logs
  ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 0;

-- Atualizar registros existentes com valor padrão
UPDATE public.agenda_push_logs 
  SET target_count = 0 
  WHERE target_count IS NULL;

-- Comentário descritivo
COMMENT ON COLUMN public.agenda_push_logs.target_count IS 
  'Número de destinatários (External User IDs) que foram alvejados no disparo do push';
