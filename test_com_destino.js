require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('comunicados').select('id, destino').eq('id', 'AD-COM-REL-STU-1781317683557-4697-g9fkm').single();
  console.log(JSON.stringify(data, null, 2));
}
run();
