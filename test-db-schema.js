const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'saida_calls' });
  if (error) {
     console.log("No RPC, fetching one row...");
     const { data: row } = await supabase.from('saida_calls').select('*').limit(1);
     console.log(row);
  } else {
     console.log(data);
  }
}
run();
