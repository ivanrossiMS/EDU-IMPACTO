const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const cond1 = `dados->"funcionariosIds".cs.["123"]`;
  const cond2 = `dados->funcionariosIds.cs.["123"]`;
  
  const { data: d1, error: e1 } = await supabase.from('comunicados').select('id').or(cond1).limit(1);
  console.log("Cond1:", e1 ? e1.message : "OK");
  
  const { data: d2, error: e2 } = await supabase.from('comunicados').select('id').or(cond2).limit(1);
  console.log("Cond2:", e2 ? e2.message : "OK");
}
test();
