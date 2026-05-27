require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('aluno_responsavel').select('aluno_id, responsavel_id, responsaveis(nome, email, id)').in('aluno_id', ['5281', '5271', '3882']);
  console.log(JSON.stringify(data, null, 2));
}
run();
