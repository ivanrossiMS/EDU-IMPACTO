-- Tabela de configuração do Check-in de Bem-Estar
CREATE TABLE IF NOT EXISTS public.gp_checkin_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  ativo BOOLEAN DEFAULT TRUE,
  frequencia_dias INT DEFAULT 7,
  titulo_modal TEXT DEFAULT 'Check-in de Bem-Estar',
  subtitulo_modal TEXT DEFAULT 'Acompanhamento Semanal',
  pergunta_emocao TEXT DEFAULT 'Como foi essa sua semana no ambiente de trabalho?',
  emocoes JSONB DEFAULT '[
    {"label": "Muito bem", "emoji": "🙂", "color": "#10b981"},
    {"label": "Bem", "emoji": "😊", "color": "#34d399"},
    {"label": "Regular", "emoji": "😐", "color": "#fbbf24"},
    {"label": "Cansado", "emoji": "😟", "color": "#f87171"},
    {"label": "Precisando conversar", "emoji": "😞", "color": "#ef4444"}
  ]'::jsonb,
  motivos JSONB DEFAULT '["Sobrecarga", "Conflitos", "Problemas pessoais", "Dificuldade com equipe", "Outro"]'::jsonb,
  perguntas_burnout JSONB DEFAULT '[
    {"id": "q1", "pergunta": "Estou dormindo bem?", "invertida": false},
    {"id": "q2", "pergunta": "Tenho energia para trabalhar?", "invertida": false},
    {"id": "q3", "pergunta": "Tenho sentido ansiedade?", "invertida": true},
    {"id": "q4", "pergunta": "Estou sobrecarregado?", "invertida": true},
    {"id": "q5", "pergunta": "Consigo descansar?", "invertida": false}
  ]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir registro padrão único
INSERT INTO public.gp_checkin_config (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Adicionar coluna respostas_json em colaborador_checkin se não existir
ALTER TABLE public.colaborador_checkin 
ADD COLUMN IF NOT EXISTS respostas_json JSONB DEFAULT '{}'::jsonb;

-- RLS para gp_checkin_config
ALTER TABLE public.gp_checkin_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura publica de config checkin" ON public.gp_checkin_config;
CREATE POLICY "Permitir leitura publica de config checkin" ON public.gp_checkin_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir alteracao para admins" ON public.gp_checkin_config;
CREATE POLICY "Permitir alteracao para admins" ON public.gp_checkin_config FOR ALL USING (true);
