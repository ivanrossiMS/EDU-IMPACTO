const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('agenda_grupos')
    .select('dados')
    .eq('dados->>nome', 'Direção');
  console.log("Error:", error ? error.message : null);
  if (data && data.length > 0) console.log("Colabs:", JSON.stringify(data[0].dados.colaboradoresIds));
}
test();
