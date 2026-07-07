const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error: e1 } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.arquivos_adaptadas ADD COLUMN IF NOT EXISTS tamanho_bytes bigint;' });
  const { error: e2 } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.arquivos_adaptadas ADD COLUMN IF NOT EXISTS bimestre text;' });
  console.log("e1:", e1, "e2:", e2);
}
run();
