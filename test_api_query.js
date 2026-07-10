const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('comunicados').select('id').or('dados->funcionariosIds.cs.["test"]');
  console.log("No quotes:", error ? error.message : data);
  const { data: d2, error: e2 } = await supabase.from('comunicados').select('id').or('dados->"funcionariosIds".cs.["test"]');
  console.log("With quotes:", e2 ? e2.message : d2);
  const { data: d3, error: e3 } = await supabase.from('comunicados').select('id').contains('dados->funcionariosIds', '["test"]');
  console.log("Contains:", e3 ? e3.message : d3);
}
test();
