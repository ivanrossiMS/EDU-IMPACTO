require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // bypass RLS
);

async function run() {
  const { data: alunos, error } = await supabase
    .from('alunos')
    .select('id, nome, matricula, dados')
    .ilike('nome', '%Alana%');

  if (error) {
    console.error("Error fetching alunos:", error);
    return;
  }

  for (const a of alunos) {
    console.log(`\n=== ${a.id} - ${a.nome} ===`);
    console.log("matricula:", a.matricula);
    console.log("dados.codigo:", a.dados?.codigo);
    
    const { data: links, error: linksError } = await supabase
      .from('aluno_responsavel')
      .select('aluno_id, responsavel_id')
      .eq('aluno_id', a.id);
    console.log("Links (by id):", links?.map(l => l.responsavel_id));

    if (a.matricula) {
      const { data: linksMat } = await supabase
        .from('aluno_responsavel')
        .select('aluno_id, responsavel_id')
        .eq('aluno_id', String(a.matricula));
      console.log("Links (by matricula string):", linksMat?.map(l => l.responsavel_id));
    }
  }
}

run();
