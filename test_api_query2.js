require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  let query = supabase.from('ocorrencias').select('*').order('created_at', { ascending: false });
  query = query.gte('created_at', '2026-05-17T19:51:55.030103+00:00');
  query = query.or(`aluno_id.eq.4697,dados->>aluno_id.eq.4697,dados->>alunoId.eq.4697`);
  const { data, error } = await query;
  console.log("Data length:", data ? data.length : null);
}
check();
