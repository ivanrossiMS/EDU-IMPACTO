CREATE TABLE IF NOT EXISTS public.agenda_contatos_rapidos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  telefone text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agenda_contatos_rapidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contatos rápidos são visíveis para todos" 
  ON public.agenda_contatos_rapidos 
  FOR SELECT 
  USING (true);

CREATE POLICY "Contatos rápidos podem ser inseridos por admin" 
  ON public.agenda_contatos_rapidos 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Contatos rápidos podem ser editados por admin" 
  ON public.agenda_contatos_rapidos 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Contatos rápidos podem ser deletados por admin" 
  ON public.agenda_contatos_rapidos 
  FOR DELETE 
  USING (true);
