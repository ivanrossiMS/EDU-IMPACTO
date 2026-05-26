require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('saida_config').select('*');
  console.log('Result:', JSON.stringify(data, null, 2));
}
test();
