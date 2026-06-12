BEGIN;
-- Remove from publication to avoid errors if they are already there
-- We can just do ADD, it will error if it's already there but we can catch it or use DO block

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'comunicados'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE comunicados;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'momentos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE momentos;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'eventos_agenda'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE eventos_agenda;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'ocorrencias'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ocorrencias;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'boletins'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE boletins;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'frequencias'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE frequencias;
    END IF;
END $$;
COMMIT;
