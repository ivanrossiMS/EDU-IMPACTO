const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'provas_upload_requisicoes' }).catch(() => ({}));
  console.log("Policies via RPC:", data);
  // Alternative: query pg_policies
  const { data: policies } = await supabase.from('pg_policies').select('*').eq('tablename', 'provas_upload_requisicoes').catch(() => ({}));
  console.log("pg_policies:", policies);
}
run();
