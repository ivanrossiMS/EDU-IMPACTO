-- Criar tabela de alertas lidos
CREATE TABLE IF NOT EXISTS public.alertas_lidos (
    id SERIAL PRIMARY KEY,
    alerta_id TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de grupos do calendário
CREATE TABLE IF NOT EXISTS public.agenda_grupos (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.alertas_lidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_grupos ENABLE ROW LEVEL SECURITY;

-- Criar políticas (acesso total para autenticados)
CREATE POLICY "Acesso total para alertas_lidos" ON public.alertas_lidos
    FOR ALL USING (true); -- Permitindo acesso para simplificar, como nos outros

CREATE POLICY "Acesso total para agenda_grupos" ON public.agenda_grupos
    FOR ALL USING (true);
