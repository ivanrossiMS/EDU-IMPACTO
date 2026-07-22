-- Enable Realtime publication and REPLICA IDENTITY FULL for saida_calls
ALTER TABLE public.saida_calls REPLICA IDENTITY FULL;

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

-- Allow anon read/select access on saida_calls for unauthenticated TV monitors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'saida_calls' 
        AND policyname = 'Allow read access for anon on saida_calls'
    ) THEN
        CREATE POLICY "Allow read access for anon on saida_calls" ON public.saida_calls
            FOR SELECT TO anon USING (true);
    END IF;
END $$;
