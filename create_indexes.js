const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = `
    CREATE INDEX IF NOT EXISTS idx_alunos_turma ON public.alunos (turma);
    CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_aluno ON public.aluno_responsavel (aluno_id);
    CREATE INDEX IF NOT EXISTS idx_aluno_responsavel_responsavel ON public.aluno_responsavel (responsavel_id);
    CREATE INDEX IF NOT EXISTS idx_turmas_codigo ON public.turmas (codigo);
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  console.log("Indexes creation:", data, error);
}
run();
