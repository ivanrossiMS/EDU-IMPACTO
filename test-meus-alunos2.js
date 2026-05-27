require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const responsavel_id = "215101";
  const { data } = await supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, alunos(nome)').eq('responsavel_id', responsavel_id);
  console.log(JSON.stringify(data, null, 2));
}
run();
