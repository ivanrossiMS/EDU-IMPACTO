import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('alunos').select('status, dados');
  const counts = {};
  data.forEach(d => {
    let s = d.status || 'NULL';
    let s2 = d.dados?.ativo;
    counts[s] = counts[s] || {};
    counts[s][s2] = (counts[s][s2] || 0) + 1;
  });
  console.log(counts);
}
run();
