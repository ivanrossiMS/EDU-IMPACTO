require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'ivanrossi@gmail.com' || u.user_metadata?.nome?.toLowerCase().includes('ivan'));
  console.log('User metadata:', user?.user_metadata);
}
check();
