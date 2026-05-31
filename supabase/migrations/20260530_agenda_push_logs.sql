-- Criação da tabela de logs de Push Notifications da Agenda Digital
CREATE TABLE IF NOT EXISTS public.agenda_push_logs (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id TEXT, -- ID de quem disparou a ação (aluno, colaborador, admin)
    type TEXT NOT NULL, -- comunicados | momentos | calendario | frequencia | ocorrencias | notas
    item_id TEXT NOT NULL, -- ID do lançamento para evitar duplo push no mesmo item
    title TEXT,
    message TEXT,
    target_url TEXT,
    status TEXT NOT NULL, -- sent | failed | skipped
    error_message TEXT,
    onesignal_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Opcional, porém recomendado para segurança)
ALTER TABLE public.agenda_push_logs ENABLE ROW LEVEL SECURITY;

-- Como essa tabela é usada primariamente pela Service Role e API, 
-- não precisamos de Policies públicas, mas podemos adicionar para Admins no futuro.

-- Índice para buscar rapidamente por item_id e evitar duplicidades:
CREATE INDEX IF NOT EXISTS idx_agenda_push_logs_item_id_type ON public.agenda_push_logs (item_id, type);
