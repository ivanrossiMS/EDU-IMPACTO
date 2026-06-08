require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('ocorrencias').select('*').or(`aluno_id.eq.4697,dados->>aluno_id.eq.4697,dados->>alunoId.eq.4697`);
  console.log("DB Matches:", data?.length);
}
check();
