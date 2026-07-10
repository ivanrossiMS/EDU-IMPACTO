require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const alunoId = '4697';
  const resolvedTurma = '4º ANO A - MATUTINO';
  
  let query = supabase.from('comunicados').select('id, titulo, destino, tipo, dados').not('id', 'like', 'AD-COM-REL-COLAB-%');
  
  let conditions = [`destino.eq.todos`];
  conditions.push(`dados->turmas.cs.["${resolvedTurma}"]`);
  conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
  conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
  
  query = query.or(conditions.join(','));
  
  const { data, error } = await query;
  if (data) {
    data.forEach(c => console.log(c.id, '|', c.titulo, '| destino:', c.destino, '| tipo:', c.tipo));
  }
}
check();
