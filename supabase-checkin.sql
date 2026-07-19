DROP TABLE IF EXISTS colaborador_checkin;

CREATE TABLE IF NOT EXISTS colaborador_checkin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id TEXT NOT NULL,
  data_checkin TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emocao_geral TEXT NOT NULL,
  motivos JSONB,
  burnout_q1 INT,
  burnout_q2 INT,
  burnout_q3 INT,
  burnout_q4 INT,
  burnout_q5 INT,
  risco_burnout TEXT,
  quer_conversar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE colaborador_checkin ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir select para o proprio usuario ou admins" 
ON colaborador_checkin FOR SELECT 
USING (
  usuario_id = auth.uid()::text OR 
  (EXISTS (SELECT 1 FROM system_users WHERE id = auth.uid()::text AND (perfil = 'Diretor Geral' OR perfil = 'Secretaria' OR perfil = 'Coordenador Pedagógico')))
);

CREATE POLICY "Permitir insert autenticado" 
ON colaborador_checkin FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permitir update auth"
ON colaborador_checkin FOR UPDATE
USING (auth.role() = 'authenticated');
