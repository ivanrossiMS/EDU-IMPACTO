import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('alunos').select('id, nome, data_nascimento');
  const jun = data.filter(a => a.data_nascimento && a.data_nascimento.includes('-06-'));
  console.log('June birthdays count:', jun.length);
  console.log(jun.slice(0, 5));
}
run();
