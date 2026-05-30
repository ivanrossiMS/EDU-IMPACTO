const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: list } = await supabase.from('comunicados').select('*').order('created_at', { ascending: false }).limit(3);
  for (const c of list) {
    console.log(`Comunicado ${c.id} "${c.titulo}":`, {
      destino: c.destino,
      dados: c.dados,
      created_at: c.created_at,
      data: c.data
    });
  }
}
check();
