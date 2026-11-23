-- Tabela para rastrear recebimento efetivo (entrega no feed do app/web ou push)
-- Permite distinguir "Enviado" vs "Recebido no App/Push" vs "Lido"
CREATE TABLE IF NOT EXISTS public.agenda_notification_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'familiar',
    content_type TEXT NOT NULL DEFAULT 'comunicado',
    content_id TEXT NOT NULL,
    aluno_id TEXT,
    channel TEXT NOT NULL DEFAULT 'feed',
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_deliveries_unique
    ON public.agenda_notification_deliveries (usuario_id, content_type, content_id, COALESCE(aluno_id, 'none'));

CREATE INDEX IF NOT EXISTS idx_agenda_deliveries_content
    ON public.agenda_notification_deliveries (content_id);

CREATE INDEX IF NOT EXISTS idx_agenda_deliveries_user
    ON public.agenda_notification_deliveries (usuario_id);

ALTER TABLE public.agenda_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver proprias entregas" ON public.agenda_notification_deliveries;
CREATE POLICY "Usuarios podem ver proprias entregas"
    ON public.agenda_notification_deliveries FOR SELECT
    USING (auth.uid()::text = usuario_id OR (auth.jwt()->>'role' = 'service_role'));

DROP POLICY IF EXISTS "Service role gerencia entregas" ON public.agenda_notification_deliveries;
CREATE POLICY "Service role gerencia entregas"
    ON public.agenda_notification_deliveries FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');
