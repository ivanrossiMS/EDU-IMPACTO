require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  let query = supabase.from('ocorrencias').select('*').order('created_at', { ascending: false });
  query = query.or(`aluno_id.eq.4697,dados->>aluno_id.eq.4697,dados->>alunoId.eq.4697`);
  const { data, error } = await query;
  console.log("Anon Data length:", data ? data.length : null);
  console.log("Anon Error:", error);
}
check();
