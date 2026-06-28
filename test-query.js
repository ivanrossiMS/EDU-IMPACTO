const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('simulados_disciplinas')
    .select('*, system_users(nome)')
    .limit(1);
  if (error) {
    console.error("ERROR system_users:", error.message);
  } else {
    console.log("SUCCESS system_users");
  }
}
test();
