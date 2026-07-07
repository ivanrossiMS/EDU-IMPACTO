const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('alunos').select('id, nome, matricula, turma').ilike('nome', '%B_rbara%La%Salvia%Pontes%Braga%');
  console.log('Barbara:', data, error);
}
run();
