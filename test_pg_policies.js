require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('ocorrencias').select('*');
  console.log("Error:", error);
  const { data: q } = await supabase.rpc('query_pg_policies', { table_name: 'ocorrencias' }); // If RPC doesn't exist it will fail
  console.log(q);
}
check();
