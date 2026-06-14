require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Let's mimic what route.ts does exactly
  let query = supabase.from('comunicados').select('*');
  const turmaId = '4º ANO A';
  const alunoId = '4697';
  
  if (turmaId || alunoId) {
    const conditions = [`destino.eq.todos`];
    if (turmaId) {
      conditions.push(`dados->turmas.cs.["${turmaId}"]`);
    }
    if (alunoId) {
      conditions.push(`dados->alunosIds.cs.["${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["a_${alunoId}"]`);
      conditions.push(`dados->alunosIds.cs.["_ALU${alunoId}"]`);
    }
    query = query.or(conditions.join(','));
  }
  
  const { data, error } = await query;
  console.log("Found:", data?.length);
}
run();
