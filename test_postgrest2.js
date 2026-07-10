const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const uuid = "51eb2bca-6f18-41bd-b37d-8e1b62d6e775";
  const { data, error } = await supabase.from('comunicados').select('id').or(`dados->"funcionariosIds".cs.["${uuid}"]`);
  console.log("With quotes:", error ? error.message : data.length);
  const { data: d2, error: e2 } = await supabase.from('comunicados').select('id').or(`dados->funcionariosIds.cs.["${uuid}"]`);
  console.log("No quotes:", e2 ? e2.message : d2.length);
}
test();
