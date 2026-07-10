require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('comunicados').select('id, dados').ilike('titulo', '%Bem-vindo%').limit(1).order('created_at', { ascending: false });
  console.log(JSON.stringify(data.map(d => ({ id: d.id, autorFoto: d.dados.autorFoto, autorId: d.dados.autorId })), null, 2));
}
check();
