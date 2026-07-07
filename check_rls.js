const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: `
    SELECT pol.polname, pol.polcmd, pol.polroles
    FROM pg_policy pol
    JOIN pg_class tbl ON pol.polrelid = tbl.oid
    WHERE tbl.relname = 'arquivos_adaptadas';
  `});
  if (error) {
     console.log("No exec_sql, getting from api");
     const { data: d2, error: e2 } = await supabase.from('arquivos_adaptadas').select('*').limit(1);
     console.log(e2, d2);
  } else {
     console.log(data);
  }
}
run();
