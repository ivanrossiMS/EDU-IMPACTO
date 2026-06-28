const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: turmasDb } = await supabase.from('turmas').select('id, nome');
  console.log('Turmas table names:', turmasDb.slice(0, 5).map(t => t.nome));

  const { data: alunosDb } = await supabase.from('alunos').select('id, nome, turma').limit(10);
  console.log('Alunos table turmas:', alunosDb.map(a => a.turma));
}
test().catch(console.error);
