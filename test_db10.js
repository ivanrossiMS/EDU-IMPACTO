const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('agenda_grupos').select('*').limit(3);
  console.log("Error:", error ? error.message : null);
  console.log("Grupos:", JSON.stringify(data, null, 2));
}
test();
