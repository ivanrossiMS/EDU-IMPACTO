const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const uuid = "51eb2bca-6f18-41bd-b37d-8e1b62d6e775";
  // The exact code from the API route:
  const query = supabase.from('comunicados').select('id, dados').or(`dados->"funcionariosIds".cs.["${uuid}"]`);
  const { data, error } = await query;
  console.log("Error:", error ? error.message : null);
  console.log("Data Length:", data ? data.length : 0);
  console.log("Data IDs:", data ? data.map(d => d.id) : []);
}
test();
