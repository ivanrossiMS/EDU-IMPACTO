-- Habilita o Realtime e configura REPLICA IDENTITY FULL (para enviar o objeto antigo no DELETE e UPDATE)

-- Função utilitária anônima para adicionar à publicação de forma idempotente
DO $$
BEGIN
    -- comunicados
    ALTER TABLE public.comunicados REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comunicados') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comunicados;
    END IF;

    -- momentos
    ALTER TABLE public.momentos REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'momentos') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.momentos;
    END IF;

    -- eventos_agenda
    ALTER TABLE public.eventos_agenda REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'eventos_agenda') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.eventos_agenda;
    END IF;

    -- frequencias
    ALTER TABLE public.frequencias REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'frequencias') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.frequencias;
    END IF;

    -- ocorrencias
    ALTER TABLE public.ocorrencias REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ocorrencias') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias;
    END IF;

    -- boletins
    ALTER TABLE public.boletins REPLICA IDENTITY FULL;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'boletins') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.boletins;
    END IF;
END $$;
