CREATE TABLE public.provas (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    titulo TEXT NOT NULL,
    id_bimestre UUID REFERENCES public.simulados_bimestres(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'rascunho',
    data_aplicacao DATE,
    turmas JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    aprovado_por TEXT,
    data_aprovacao TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.provas_requisicoes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    id_prova UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
    id_disciplina UUID NOT NULL REFERENCES public.simulados_disciplinas(id) ON DELETE CASCADE,
    id_professor UUID NOT NULL, -- references users/funcionarios but kept as uuid
    quantidade_questoes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.provas_questoes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    id_prova UUID NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
    id_disciplina UUID NOT NULL REFERENCES public.simulados_disciplinas(id) ON DELETE CASCADE,
    id_professor UUID NOT NULL,
    enunciado TEXT NOT NULL,
    nivel_dificuldade TEXT DEFAULT 'media',
    tipo_questao TEXT DEFAULT 'multipla_escolha',
    eh_adaptada BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    pontuacao NUMERIC DEFAULT 1,
    banco_questao BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.provas_alternativas (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    id_questao UUID NOT NULL REFERENCES public.provas_questoes(id) ON DELETE CASCADE,
    letra TEXT NOT NULL,
    texto TEXT NOT NULL,
    eh_correta BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.provas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provas_alternativas ENABLE ROW LEVEL SECURITY;

-- Policies for provas
CREATE POLICY "Enable all for authenticated users on provas" ON public.provas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on provas_requisicoes" ON public.provas_requisicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on provas_questoes" ON public.provas_questoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on provas_alternativas" ON public.provas_alternativas FOR ALL TO authenticated USING (true) WITH CHECK (true);
