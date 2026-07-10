require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'ad_config').single();
  console.log(JSON.stringify(data?.valor?.saudacao, null, 2));
}
check();
