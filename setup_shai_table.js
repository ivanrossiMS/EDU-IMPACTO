require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lrpwerkkqrjkcauofhph.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Criando tabela shai_colaboradores no Supabase...");
  const sql = `
    CREATE TABLE IF NOT EXISTS shai_colaboradores (
      id TEXT PRIMARY KEY,
      unidade TEXT,
      nome TEXT NOT NULL,
      cpf TEXT,
      data_nascimento TEXT,
      whatsapp TEXT,
      codigo TEXT,
      status TEXT DEFAULT 'pendente',
      enviado_em TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shai_configuracoes (
      id TEXT PRIMARY KEY,
      mensagem_template TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE shai_colaboradores ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shai_configuracoes ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on shai_colaboradores') THEN
        CREATE POLICY "Allow all on shai_colaboradores" ON shai_colaboradores FOR ALL USING (true) WITH CHECK (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on shai_configuracoes') THEN
        CREATE POLICY "Allow all on shai_configuracoes" ON shai_configuracoes FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END $$;
  `;

  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  if (error) {
    console.log("RPC execute_sql error:", error);
  } else {
    console.log("Sucesso ao criar tabelas do SHAI:", data);
  }
}

run();
