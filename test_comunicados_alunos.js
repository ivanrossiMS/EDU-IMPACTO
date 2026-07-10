require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('comunicados').select('dados').limit(5);
  for (const row of data) {
    if (row.dados && row.dados.alunosIds) {
      console.log(typeof row.dados.alunosIds[0], row.dados.alunosIds);
    }
  }
}
check();
