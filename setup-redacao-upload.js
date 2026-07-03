const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.redacao_upload (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo TEXT NOT NULL,
      descricao TEXT,
      data_aplicacao DATE,
      turmas TEXT[],
      series TEXT[],
      status TEXT DEFAULT 'aguardando_upload',
      bimestre TEXT,
      tipo TEXT DEFAULT 'redacao_upload',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
      questoes_json JSONB DEFAULT '[]'::jsonb,
      questoes_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS public.redacao_upload_requisicoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      id_redacao_upload UUID REFERENCES public.redacao_upload(id) ON DELETE CASCADE,
      id_professor UUID REFERENCES public.usuarios(id),
      professor_nome TEXT,
      id_disciplina UUID REFERENCES public.disciplinas(id),
      disciplina_nome TEXT,
      qtd_questoes INTEGER,
      status TEXT DEFAULT 'pendente',
      enviado_em TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
    );

    -- Ensure RLS is disabled for ease of development for now, or match current policies
    ALTER TABLE public.redacao_upload DISABLE ROW LEVEL SECURITY;
    ALTER TABLE public.redacao_upload_requisicoes DISABLE ROW LEVEL SECURITY;
  `;

  // Supabase JS doesn't have a direct raw SQL method via anon key, so we use a Postgres function or psql.
  // Wait, I can't use raw SQL via JS without the service_role key or psql.
  // Let me check if there's a postgres connection string in .env.local
  console.log('Use psql or a function to execute SQL.');
}
run();
