require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: data2 } = await supabase.auth.admin.listUsers();
  console.log(data2.users.map(u => ({ id: u.id, email: u.email, nome: u.user_metadata?.nome })));
}
check();
