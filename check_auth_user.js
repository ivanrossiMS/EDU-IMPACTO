require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.auth.admin.getUserById('fc3bb60c-2d06-4b8c-b9b0-a6bb1bb24810');
  console.log(data?.user?.email, data?.user?.user_metadata?.foto);
  
  const { data: data2 } = await supabase.auth.admin.listUsers();
  const ivan = data2.users.find(u => u.email.includes('ivan') || (u.user_metadata?.nome && u.user_metadata?.nome.includes('Ivan')));
  console.log('Ivan Auth ID:', ivan?.id, ivan?.email, ivan?.user_metadata?.foto);
}
check();
