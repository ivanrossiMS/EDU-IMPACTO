require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  const { data, error } = await supabase.from('comunicados').select('id, dados').ilike('titulo', '%Bem-vindo%');
  if (data && data.length > 0) {
    for (const row of data) {
      let dados = row.dados;
      dados.autorId = '86d68326-347b-4124-9f82-7e136008d704'; // The ID that works for the other posts
      dados.autor = 'Ivan Rossi';
      const { error: updErr } = await supabase.from('comunicados').update({ dados }).eq('id', row.id);
      console.log('Updated:', row.id, updErr);
    }
  }
}
fix();
