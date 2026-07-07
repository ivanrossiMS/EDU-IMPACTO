const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const res1 = await supabase.from('users_view').select('*').limit(1);
  const res2 = await supabase.from('profiles').select('*').limit(1);
  const res3 = await supabase.from('funcionarios').select('id, user_id, nome').limit(2);
  console.log('users_view:', res1.data, res1.error);
  console.log('profiles:', res2.data, res2.error);
  console.log('funcionarios:', res3.data, res3.error);
}
run();
