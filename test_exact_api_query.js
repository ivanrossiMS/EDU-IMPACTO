require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const resolvedTurma = "1º ANO A - MATUTINO";
  const alunoId = "4697";
  const conditions = [`destino.eq.todos`];
  conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
  conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);

  const { data, error } = await supabase.from('comunicados').select('id, titulo, destino, created_at')
    .or(conditions.join(','))
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Error:', error);
  data?.forEach(c => console.log(c.id, c.titulo));
}
check();
