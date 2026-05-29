const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'saida_calls' });
  // Instead of rpc, let's just query pg_trigger if possible, but PostgREST doesn't expose pg_trigger by default.
  console.log("No easy way to check triggers without raw SQL access");
}
test();
