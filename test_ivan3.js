require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.auth.admin.listUsers();
  const ivan = data.users.find(u => JSON.stringify(u).toLowerCase().includes('ivan'));
  console.log(ivan?.user_metadata);
}
check();
