require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE simulados_bimestres ADD COLUMN IF NOT EXISTS ano_letivo TEXT;"
  });
  console.log('Result:', data, 'Error:', error);
}
run();
