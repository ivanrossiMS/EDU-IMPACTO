const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('comunicados').select('id, dados').or('dados->"funcionariosIds".cs.["3bbdfb9c-7828-4ceb-85bd-bdc2c8f8d689"]').limit(2);
  console.log("With quotes:", error ? error.message : data);
  const { data: d2, error: e2 } = await supabase.from('comunicados').select('id, dados').or('dados->funcionariosIds.cs.["3bbdfb9c-7828-4ceb-85bd-bdc2c8f8d689"]').limit(2);
  console.log("No quotes:", e2 ? e2.message : d2);
}
test();
