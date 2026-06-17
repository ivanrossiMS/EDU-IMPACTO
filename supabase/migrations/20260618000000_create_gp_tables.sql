CREATE TABLE IF NOT EXISTS public.gp_atendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario TEXT,
    tipo TEXT,
    data TEXT,
    status TEXT,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT,
    local TEXT,
    responsavel TEXT,
    data TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_plano_acao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT,
    responsavel TEXT,
    prazo TEXT,
    status TEXT,
    prioridade TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_treinamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso TEXT,
    carga_horaria TEXT,
    data TEXT,
    instrutor TEXT,
    status TEXT,
    participantes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_inventario_riscos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setor TEXT,
    perigo TEXT,
    risco TEXT,
    nivel TEXT,
    medida_controle TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_sst_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT,
    titulo TEXT,
    revisao TEXT,
    medico TEXT,
    vigencia TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gp_sst_asos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador TEXT,
    tipo_exame TEXT,
    vencimento TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
