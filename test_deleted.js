require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('comunicados').select('id, titulo, dados').in('id', [
    'AD-COM-REL-STU-1783466103114-4697-qf7es',
    'AD-COM-COLAB-1783271336615',
    'AD-COM-COLAB-1782962067631'
  ]);
  data.forEach(c => console.log(c.id, c.dados?.deleted, c.dados?.ativo));
}
check();
