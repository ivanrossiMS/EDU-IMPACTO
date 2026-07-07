const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Testing with ANON KEY to simulate frontend access
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('system_users').select('id, nome');
  console.log('system_users ANON:', data, error);
}
run();
