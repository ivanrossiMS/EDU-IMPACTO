const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { count, error } = await supabase
    .from('saida_calls')
    .select('*', { count: 'exact', head: true });
  console.log("COUNT:", count);
  console.log("ERROR:", error);
}
test();
