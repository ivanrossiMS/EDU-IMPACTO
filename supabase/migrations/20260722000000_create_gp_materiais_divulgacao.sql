-- Migration: Create gp_materiais_divulgacao table for Gestão de Pessoas
CREATE TABLE IF NOT EXISTS public.gp_materiais_divulgacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT DEFAULT 'Guias & E-books',
    link TEXT NOT NULL,
    imagem_url TEXT,
    contador_visitas INTEGER DEFAULT 0,
    tags TEXT[],
    autor TEXT DEFAULT 'Equipe Pedagógica',
    data_publicacao TIMESTAMPTZ DEFAULT now(),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policy: Allow all authenticated and anon users to read active materials
ALTER TABLE public.gp_materiais_divulgacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to gp_materiais_divulgacao" 
ON public.gp_materiais_divulgacao FOR SELECT USING (true);

CREATE POLICY "Allow all to update visit counter in gp_materiais_divulgacao" 
ON public.gp_materiais_divulgacao FOR UPDATE USING (true);

CREATE POLICY "Allow authenticated users to insert gp_materiais_divulgacao" 
ON public.gp_materiais_divulgacao FOR INSERT WITH CHECK (true);

-- Insert initial sample materials
INSERT INTO public.gp_materiais_divulgacao (titulo, descricao, categoria, link, imagem_url, contador_visitas, tags, autor)
VALUES 
(
    'Guia de Segurança Digital para Pais e Responsáveis',
    'E-book e guia prático interativo sobre Controle Parental, tempo de tela, redes sociais e segurança no celular para famílias do Colégio Impacto.',
    'Guias & E-books',
    '/guia-seguranca',
    '/guia-seguranca/family_digital_safety.jpg',
    42,
    ARRAY['Segurança Digital', 'Controle Parental', 'Família', 'E-book'],
    'Equipe Pedagógica – Colégio Impacto'
),
(
    'Manual da Agenda Digital & Comunicação Escolar',
    'Guia oficial sobre como utilizar a Agenda Digital, envio de comunicados, acompanhamento de notas e atendimento às famílias.',
    'Manuais & Tutoriais',
    '/ajuda',
    NULL,
    28,
    ARRAY['Agenda Digital', 'Comunicação', 'Tutoriais', 'Suporte'],
    'Secretaria & T.I. – Colégio Impacto'
),
(
    'Folder Oficial de Matrículas & Rematrículas 2027',
    'Material de divulgação contendo proposta pedagógica, valores, programas de bolsas e diferenciais do Colégio Impacto.',
    'Campanhas & Folders',
    '/guia-seguranca',
    NULL,
    19,
    ARRAY['Matrículas', 'Campanhas', 'Divulgação'],
    'Marketing & Comunicação'
)
ON CONFLICT DO NOTHING;
