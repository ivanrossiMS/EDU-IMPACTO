import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('system_collections').select('*').in('id', ['administrativo/pedidos-livros', 'administrativo/pedidos-livros-manuais']);
  for(const d of data||[]) {
    console.log(d.id, JSON.stringify(d.dados[0]));
  }
}
run();
