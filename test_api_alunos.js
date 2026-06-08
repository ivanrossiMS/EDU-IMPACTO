require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const id = '4697';
  const { data: byId } = await supabase
    .from('alunos')
    .select('*')
    .eq('id', id)
    .single()

  console.log('byId:', byId ? byId.nome : null);
  
  if (!byId) {
     const { data: byAny } = await supabase
        .from('alunos')
        .select('*')
        .or(`matricula.eq.${id},dados->>codigo.eq.${id}`);
     console.log('byAny:', byAny ? byAny.length : null);
  }
}
check();
