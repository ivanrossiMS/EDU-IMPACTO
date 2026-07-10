const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const userId = "453d71b4-6abd-4326-bb2b-08a83be5a996";
  const { data, error } = await supabase.from('agenda_grupos').select('id, dados').contains('dados->colaboradoresIds', `["${userId}"]`);
  console.log("Error:", error ? error.message : null);
  console.log("Matched Grupos:", JSON.stringify(data, null, 2));
}
test();
