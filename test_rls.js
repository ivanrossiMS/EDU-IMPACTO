require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.rpc('get_policies');
  // If get_policies doesn't exist, we can query pg_policies
  const { data: policies, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'ocorrencias');
  if (error) {
     const { data: q, error: e } = await supabase.rpc('run_sql', { sql: "SELECT * FROM pg_policies WHERE tablename = 'ocorrencias';" });
     console.log(q || e);
  } else {
     console.log("Policies:", policies);
  }
}
check();
