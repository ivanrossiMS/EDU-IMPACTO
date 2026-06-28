const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: g } = await supabase.from('agenda_grupos').select('id, dados').limit(10);
  console.log('agenda_grupos data:', JSON.stringify(g, null, 2));
}
run();
