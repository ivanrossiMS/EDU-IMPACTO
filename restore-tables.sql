CREATE TABLE IF NOT EXISTS public.agenda_chats (
    id text primary key,
    dados jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.agenda_mensagens (
    id text primary key,
    dados jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS
ALTER TABLE public.agenda_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensagens ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated operations since legacy API manipulates it arbitrarily
CREATE POLICY "Allow all operations for authenticated users on agenda_chats" 
    ON public.agenda_chats FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on agenda_mensagens" 
    ON public.agenda_mensagens FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Also enable realtime explicitly if not already
alter publication supabase_realtime add table public.agenda_chats;
alter publication supabase_realtime add table public.agenda_mensagens;
