import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('alunos').select('parcelas').not('parcelas', 'is', null).limit(1);
  console.log(JSON.stringify(data?.[0]?.parcelas?.[0], null, 2));
  
  const { data: data2 } = await supabase.from('titulos').select('*').limit(1);
  console.log(JSON.stringify(data2?.[0], null, 2));
}
run();
