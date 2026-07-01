require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE simulados_configuracoes ADD COLUMN IF NOT EXISTS provas_header_layout JSONB;"
  });
  if (error) {
    console.log("RPC execute_sql failed, trying direct query if possible, or maybe it exists?", error);
    // Let's try inserting it using a raw postgrest if rpc doesn't exist.
    // If we don't have execute_sql, I'll write a prompt to the user to run the SQL themselves.
  } else {
    console.log("Success:", data);
  }
}
run();
