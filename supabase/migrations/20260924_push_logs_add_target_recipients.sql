-- Migração: Adicionar coluna target_recipients à tabela agenda_push_logs
-- Permite armazenar a lista estruturada de destinatários (nomes, papéis, e-mails e identificadores)
-- para auditoria e rastreabilidade visual completa no painel administrativo.

ALTER TABLE public.agenda_push_logs
  ADD COLUMN IF NOT EXISTS target_recipients JSONB;

COMMENT ON COLUMN public.agenda_push_logs.target_recipients IS 
  'Lista estruturada de destinatários alvejados no disparo (alunos, responsáveis, colaboradores)';
