const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('agenda_grupos')
    .select('id, dados')
    .contains('dados->colaboradoresIds', '["master-dziia1l"]');
  console.log("Error:", error ? error.message : null);
  console.log("Data count:", data ? data.length : 0);
  if (data && data.length > 0) {
    console.log("Groups:", data.map(d => d.dados.nome));
  }
}
test();
