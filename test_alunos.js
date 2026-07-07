const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('alunos').select('*').limit(2000);
  const found = data.find(a => a.nome.includes('Arthur Luz'));
  console.log('Found Arthur Luz in limit 2000?:', !!found);
}
run();
