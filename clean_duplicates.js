require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: boletins } = await supabase.from('boletins').select('id, aluno_id, turma_id, bimestre, dados');
  if (!boletins) return;

  const map = new Map();
  const toDelete = [];

  for (const b of boletins) {
    const d = typeof b.dados === 'string' ? JSON.parse(b.dados) : (b.dados || {});
    const key = `${b.aluno_id}_${b.turma_id}_${b.bimestre}_${d.ano}`;
    
    if (map.has(key)) {
      toDelete.push(b.id);
    } else {
      map.set(key, b.id);
    }
  }

  console.log(`Found ${toDelete.length} duplicates to delete.`);
  for (const id of toDelete) {
    await supabase.from('boletins').delete().eq('id', id);
    console.log(`Deleted ${id}`);
  }
}
run();
