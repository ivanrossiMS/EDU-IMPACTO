require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('alunos').select('id, nome, created_at, dados').eq('id', '4697');
  console.log("Aluno:", JSON.stringify(data, null, 2));
}
check();
