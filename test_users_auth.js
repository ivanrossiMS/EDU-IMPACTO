const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Let's get a real auth token for Ivan Rossi? Actually we can't easily do that.
  // Instead let's just check the RLS policies for system_users.
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'system_users' });
  console.log('Policies:', data, error);
}
run();
