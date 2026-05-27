require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('responsaveis').select('*').or(`email.ilike.auxiliadorahonorio41@gmail.com,nome.ilike.maria auxiliadora de araújo honório vilela`);
  console.log(JSON.stringify(data, null, 2));
}
run();
