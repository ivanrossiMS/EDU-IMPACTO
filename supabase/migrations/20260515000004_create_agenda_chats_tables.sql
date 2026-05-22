-- Criar tabela de chats da agenda
CREATE TABLE IF NOT EXISTS public.agenda_chats (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Criar tabela de mensagens da agenda
CREATE TABLE IF NOT EXISTS public.agenda_mensagens (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.agenda_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_mensagens ENABLE ROW LEVEL SECURITY;

-- Criar políticas (acesso total para autenticados)
CREATE POLICY "Acesso total para agenda_chats" ON public.agenda_chats
    FOR ALL USING (true);

CREATE POLICY "Acesso total para agenda_mensagens" ON public.agenda_mensagens
    FOR ALL USING (true);
