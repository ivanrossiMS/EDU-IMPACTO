require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const nome = "maria auxiliadora de araújo honório vilela";
  const email = "auxiliadorahonorio41@gmail.com";
  let query = supabase.from('responsaveis').select('id, nome, email').or(`email.ilike.${email},nome.ilike.${nome}`);
  const { data } = await query;
  console.log(JSON.stringify(data, null, 2));
}
run();
