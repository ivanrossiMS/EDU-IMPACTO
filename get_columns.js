const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('academico_notas_lancamento', 'academico_notas_aluno', 'academico_notas_valor') ORDER BY table_name, ordinal_position;`
  });
  console.log(JSON.stringify(data, null, 2));
}
run();
