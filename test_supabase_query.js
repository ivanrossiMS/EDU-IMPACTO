require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('comunicados').select('id, titulo')
    .or('dados->alunosIds.cs.["4697"],dados->turmas.cs.["1º ANO A - MATUTINO"]');
  console.log('Error:', error);
  console.log('Returned items:', data?.length);
  data?.forEach(c => console.log(c.id, c.titulo));
}
check();
