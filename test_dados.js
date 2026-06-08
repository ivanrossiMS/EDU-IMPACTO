require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('ocorrencias').select('dados').limit(1);
  console.log("Type of dados:", typeof data[0].dados);
  console.log("Value:", data[0].dados);
}
check();
