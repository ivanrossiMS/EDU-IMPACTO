import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  let query = supabase.from('alunos').select('id, nome, status', { count: 'exact' });
  query = query.eq('status', 'inativo');
  query = query.order('nome', { ascending: true });
  query = query.range(0, 9);
  
  const { data, count, error } = await query;
  console.log('Error:', error);
  console.log('Count:', count);
  console.log('Data:', data);
}
run();
