const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const gName = "Coordenação - Ens. Fund2/Médio";
  const cond = `dados->grupos.cs.["${gName}"]`;
  
  console.log("Testing Condition:", cond);
  const { data, error } = await supabase.from('comunicados')
    .select('id, dados->grupos')
    .or(cond)
    .limit(3);
  console.log("Error:", error ? error.message : null);
  console.log("Data:", JSON.stringify(data, null, 2));
}
test();
