require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'CREATE OR REPLACE FUNCTION get_pg_policies(t_name text) RETURNS json AS $$ DECLARE result json; BEGIN SELECT json_agg(row_to_json(p)) INTO result FROM pg_policies p WHERE tablename = t_name; RETURN result; END; $$ LANGUAGE plpgsql;' });
  console.log("Create RPC:", error ? error.message : "Success");
  
  const { data: policies, error: pError } = await supabase.rpc('get_pg_policies', { t_name: 'ocorrencias' });
  console.log("Policies:", policies);
}
createRpc();
