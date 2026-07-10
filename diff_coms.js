require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('comunicados').select('*').in('id', [
    'AD-COM-REL-STU-1783520907458-4697-n7zvz',
    'AD-COM-REL-STU-1783466537473-4697-zpyaz',
    'AD-COM-REL-STU-1783466103114-4697-qf7es',
    'AD-COM-REL-STU-1781450129633-4697-fjpgl'
  ]);
  
  data.forEach(c => {
    console.log(`\nID: ${c.id}\nTitle: ${c.titulo}\nStatus: ${c.dados?.status}\nDeleted: ${c.deleted}\nAtivo: ${c.ativo}`);
  });
}
check();
