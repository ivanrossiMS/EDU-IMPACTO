-- ============================================================================
-- Migration: 20261013000000_portaria_and_push_logs_performance_indexes.sql
-- Descrição: Índices críticos de alta seletividade para as duas maiores tabelas
--            do sistema (portaria_eventos: 37k+ e agenda_push_logs: 132k+).
--            Elimina Seq Scans e timeouts em chamadas diárias e robôs de push.
-- Idempotente e 100% seguro.
-- ============================================================================

-- 1. Tabela portaria_eventos (Otimização para Saída de Alunos, Painel de Portaria e Totem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portaria_eventos') THEN
    -- Acelera consulta de saídas/entradas com sucesso por data (usado em saida_calls e totem-frequencia)
    CREATE INDEX IF NOT EXISTS idx_portaria_eventos_tipo_status_data
      ON public.portaria_eventos (tipo, status, data_hora DESC);

    -- Acelera ordenação e paginação por data_hora (usado no painel da portaria e logs)
    CREATE INDEX IF NOT EXISTS idx_portaria_eventos_data_hora_desc
      ON public.portaria_eventos (data_hora DESC);

    -- Acelera busca de eventos por aluno (usado na auditoria e verificação de entrada)
    CREATE INDEX IF NOT EXISTS idx_portaria_eventos_aluno_data
      ON public.portaria_eventos (aluno_id, data_hora DESC);

    -- Acelera busca por identificador do equipamento/matrícula do aluno
    CREATE INDEX IF NOT EXISTS idx_portaria_eventos_equip_data
      ON public.portaria_eventos (user_id_equipamento, data_hora DESC);
  END IF;
END $$;

-- 2. Tabela agenda_push_logs (Otimização para Deduplicação Atômica e Cron Jobs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agenda_push_logs') THEN
    -- Acelera deduplicação do robô financeiro e do calendário (where type = 'cobrancas' and item_id in (...))
    CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_type_item_id
      ON public.agenda_push_logs (type, item_id);

    -- Acelera ordenação para dashboards de diagnóstico de push e auditoria
    CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_created_at_desc
      ON public.agenda_push_logs (created_at DESC);
  END IF;
END $$;
