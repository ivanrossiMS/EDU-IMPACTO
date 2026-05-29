const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.rpc('get_policies'); // or raw query
  // Let's just query pg_policies
  const { data: policies } = await supabase.from('alunos').select('*').limit(1);
  // Actually pg_policies can't be queried from postgREST easily unless exposed.
  console.log("Can query via service role");
}
test();
