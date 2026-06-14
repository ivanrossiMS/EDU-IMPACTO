require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users } = await supabase.from('system_users').select('*').ilike('nome', '%ivan ross%');
  console.log("USERS:", JSON.stringify(users, null, 2));
}
run();
