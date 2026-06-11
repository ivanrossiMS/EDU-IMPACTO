const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(supabaseUrlMatch[1].trim(), supabaseKeyMatch[1].trim());

async function check() {
  const { data: cecilia, error } = await supabase
    .from('alunos')
    .select('id, nome, turma, turno')
    .ilike('nome', '%Cecília%')
    .limit(1);

  if (error) console.error(error);
  console.log(`Cecilia:`, JSON.stringify(cecilia, null, 2));

  const { data: turmas } = await supabase.from('turmas').select('id, nome, codigo');
  console.log(`Turmas:`, JSON.stringify(turmas, null, 2));
}
check();
