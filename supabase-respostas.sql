-- Tabela de Respostas dos Comunicados
CREATE TABLE comunicados_respostas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id text NOT NULL,
  remetente_id text NOT NULL,
  remetente_nome text NOT NULL,
  conteudo text NOT NULL,
  anexos jsonb DEFAULT '[]'::jsonb,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para buscas ultra rápidas
CREATE INDEX idx_comunicados_respostas_comunicado ON comunicados_respostas(comunicado_id);
CREATE INDEX idx_comunicados_respostas_remetente ON comunicados_respostas(remetente_id);

-- Para RLS, se no futuro o acesso for direto pelo Client Supabase:
ALTER TABLE comunicados_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de respostas publica" ON comunicados_respostas FOR SELECT USING (true);
CREATE POLICY "Insercao de respostas publica" ON comunicados_respostas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualizacao de respostas publica" ON comunicados_respostas FOR UPDATE USING (true);
CREATE POLICY "Delecao de respostas publica" ON comunicados_respostas FOR DELETE USING (true);
