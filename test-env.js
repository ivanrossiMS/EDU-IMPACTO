require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const row = { id: 'default', dados: { test: 'worked' } };
  const { data, error } = await supabase.from('saida_config').upsert(row).select().single();
  console.log('Result:', { data, error });
}
test();
