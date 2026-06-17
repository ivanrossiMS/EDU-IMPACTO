const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { count: c1 } = await supabase.from('alunos').select('*', { count: 'exact', head: true });
  console.log('Total alunos:', c1);
  const { count: c2 } = await supabase.from('system_users').select('*', { count: 'exact', head: true });
  console.log('Total system_users:', c2);
}
run();
