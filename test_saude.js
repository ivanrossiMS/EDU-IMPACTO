require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: aluno } = await supabase.from('alunos').select('dados').or('matricula.eq.4697,dados->>codigo.eq.4697').single();
  console.log("AUTORIZADOS:", JSON.stringify(aluno?.dados?.saude?.autorizados, null, 2));
}
run();
