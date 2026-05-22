-- Cria tabela para histórico de documentos emitidos
CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id TEXT NOT NULL,
    documento_tipo TEXT NOT NULL,
    data_emissao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    emitido_por TEXT
);

-- Habilita RLS
ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

-- Cria política de acesso para usuários autenticados
CREATE POLICY "Permitir acesso total para autenticados" ON public.documentos_emitidos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
