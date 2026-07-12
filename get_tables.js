const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%turma%';`
  });
  console.log(JSON.stringify(data));
}
run();
