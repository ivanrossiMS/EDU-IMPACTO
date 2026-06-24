-- Tabela: simulados_bimestres
CREATE TABLE IF NOT EXISTS public.simulados_bimestres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    data_inicio DATE,
    data_fim DATE,
    status TEXT DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_disciplinas
CREATE TABLE IF NOT EXISTS public.simulados_disciplinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cor TEXT,
    id_professor TEXT REFERENCES public.system_users(id),
    quantidade_questoes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados
CREATE TABLE IF NOT EXISTS public.simulados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL DEFAULT 'simulado',
    id_bimestre UUID REFERENCES public.simulados_bimestres(id),
    status TEXT DEFAULT 'rascunho',
    data_aplicacao DATE,
    series TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_requisicoes (disciplinas e quant de questoes requeridas por prof)
CREATE TABLE IF NOT EXISTS public.simulados_requisicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_simulado UUID REFERENCES public.simulados(id) ON DELETE CASCADE,
    id_disciplina UUID REFERENCES public.simulados_disciplinas(id) ON DELETE CASCADE,
    id_professor TEXT REFERENCES public.system_users(id),
    quantidade_questoes INTEGER NOT NULL DEFAULT 10,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_questoes
CREATE TABLE IF NOT EXISTS public.simulados_questoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_simulado UUID REFERENCES public.simulados(id) ON DELETE CASCADE,
    id_disciplina UUID REFERENCES public.simulados_disciplinas(id),
    id_professor TEXT REFERENCES public.system_users(id),
    enunciado TEXT NOT NULL,
    nivel_dificuldade TEXT DEFAULT 'media',
    tipo_questao TEXT DEFAULT 'multipla_escolha',
    eh_adaptada BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    pontuacao NUMERIC(5,2) DEFAULT 1.00,
    banco_questao BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_imagens
CREATE TABLE IF NOT EXISTS public.simulados_imagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_questao UUID REFERENCES public.simulados_questoes(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    posicao TEXT DEFAULT 'apos_enunciado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_alternativas
CREATE TABLE IF NOT EXISTS public.simulados_alternativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_questao UUID REFERENCES public.simulados_questoes(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    letra TEXT,
    correta BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: simulados_logs
CREATE TABLE IF NOT EXISTS public.simulados_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    acao TEXT NOT NULL,
    descricao TEXT,
    usuario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.simulados_bimestres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados_logs ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted access for simplicity during dev since policies might be complex
CREATE POLICY "Enable all for simulados_bimestres" ON public.simulados_bimestres FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_disciplinas" ON public.simulados_disciplinas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados" ON public.simulados FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_requisicoes" ON public.simulados_requisicoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_questoes" ON public.simulados_questoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_imagens" ON public.simulados_imagens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_alternativas" ON public.simulados_alternativas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for simulados_logs" ON public.simulados_logs FOR ALL USING (true) WITH CHECK (true);

-- Functions and Triggers for updated_at
CREATE OR REPLACE FUNCTION update_simulados_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_simulados_bimestres_updated_at ON public.simulados_bimestres;
CREATE TRIGGER update_simulados_bimestres_updated_at BEFORE UPDATE ON public.simulados_bimestres FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();

DROP TRIGGER IF EXISTS update_simulados_disciplinas_updated_at ON public.simulados_disciplinas;
CREATE TRIGGER update_simulados_disciplinas_updated_at BEFORE UPDATE ON public.simulados_disciplinas FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();

DROP TRIGGER IF EXISTS update_simulados_professores_updated_at ON public.simulados_professores;
CREATE TRIGGER update_simulados_professores_updated_at BEFORE UPDATE ON public.simulados_professores FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();

DROP TRIGGER IF EXISTS update_simulados_updated_at ON public.simulados;
CREATE TRIGGER update_simulados_updated_at BEFORE UPDATE ON public.simulados FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();

DROP TRIGGER IF EXISTS update_simulados_requisicoes_updated_at ON public.simulados_requisicoes;
CREATE TRIGGER update_simulados_requisicoes_updated_at BEFORE UPDATE ON public.simulados_requisicoes FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();

DROP TRIGGER IF EXISTS update_simulados_questoes_updated_at ON public.simulados_questoes;
CREATE TRIGGER update_simulados_questoes_updated_at BEFORE UPDATE ON public.simulados_questoes FOR EACH ROW EXECUTE FUNCTION update_simulados_updated_at_column();
