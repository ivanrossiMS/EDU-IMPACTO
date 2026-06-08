require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('alunos').select('*').eq('id', '4697').single();
  console.log(JSON.stringify(data.dados.historicoTurmas, null, 2));
}
check();
