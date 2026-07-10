const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const userId = "79dc9b14-5398-4240-8a17-cf2182a4100f";
  // The query used in the backend for colaboradores
  const { data, error } = await supabase.from('comunicados').select('id, dados').contains('dados->funcionariosIds', `["${userId}"]`).limit(2);
  console.log("Error:", error ? error.message : null);
  console.log("Matched:", JSON.stringify(data, null, 2));
}
test();
