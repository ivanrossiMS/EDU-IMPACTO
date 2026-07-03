const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'provas_upload_requisicoes' });
  if (error) {
    console.log("RPC error, querying pg_policies...");
    // Let's use raw SQL if possible, but JS client doesn't support raw SQL out of the box without an RPC.
    // However, maybe there is no RPC. We will just execute a psql via an RPC if we had one.
  } else {
    console.log(data);
  }
}
run();
