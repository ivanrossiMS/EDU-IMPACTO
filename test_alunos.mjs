import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('alunos').select('status');
  const counts = {};
  data.forEach(d => {
    const s = d.status || 'NULL';
    counts[s] = (counts[s] || 0) + 1;
  });
  console.log(counts);
}
run();
