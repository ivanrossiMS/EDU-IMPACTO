const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('agenda_grupos')
    .select('dados')
    .ilike('dados->>nome', '%Coordenação%');
  console.log("Error:", error ? error.message : null);
  if (data) {
    data.forEach(d => console.log(d.dados.nome, d.dados.colaboradoresIds));
  }
}
test();
