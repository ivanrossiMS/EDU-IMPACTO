const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    -- check if provas exists
    SELECT tablename FROM pg_tables WHERE tablename = 'provas';
  `});
  console.log(data, error);
}
run();
