const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: allTurmas, error } = await supabase.from('turmas').select('*').limit(2);
  console.log(JSON.stringify(allTurmas, null, 2));
}
run();
