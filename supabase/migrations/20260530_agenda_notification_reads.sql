-- Tabela otimizada para controle de leitura (Notification Center)
CREATE TABLE IF NOT EXISTS public.agenda_notification_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id UUID NOT NULL,
    perfil TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices vitais para performance do contador (Notification Badge)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_reads_unique ON public.agenda_notification_reads(usuario_id, content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_agenda_reads_user ON public.agenda_notification_reads(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agenda_reads_content ON public.agenda_notification_reads(content_id);

-- Ativar RLS
ALTER TABLE public.agenda_notification_reads ENABLE ROW LEVEL SECURITY;

-- Politica: Usuarios so podem ver, inserir e deletar suas proprias leituras
CREATE POLICY "Usuarios podem ver proprias leituras"
ON public.agenda_notification_reads FOR SELECT
USING (auth.uid() = usuario_id OR (auth.jwt()->>'role' = 'service_role'));

CREATE POLICY "Usuarios podem inserir proprias leituras"
ON public.agenda_notification_reads FOR INSERT
WITH CHECK (auth.uid() = usuario_id OR (auth.jwt()->>'role' = 'service_role'));

