require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // bypass RLS
);

async function run() {
  const { data: alunos, error } = await supabase
    .from('alunos')
    .select('id, nome, dados, responsavel, responsavel_financeiro, responsavel_pedagogico')
    .ilike('nome', '%Alana%');

  if (error) {
    console.error("Error fetching alunos:", error);
    return;
  }

  for (const a of alunos) {
    console.log(`\n=== ${a.id} - ${a.nome} ===`);
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('*')
      .eq('aluno_id', a.id);
    
    if (linksError) {
      console.error("  Error fetching links:", linksError);
    } else {
      console.log("  Links in db:");
      console.dir(links, { depth: null });
    }
    
    console.log("  dados.responsaveis length:", a.dados?.responsaveis?.length || 0);
  }
}

run();
