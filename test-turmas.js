const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: allTurmas, error } = await supabase.from('turmas').select('id, nome, codigo, ano, ano_letivo, dados');
  if (error) console.error(error);
  else console.log(JSON.stringify(allTurmas, null, 2));
}
run();
