require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: mData } = await supabase.from('comunicados_respostas').select('comunicado_id, conteudo, remetente_nome').ilike('conteudo', '%Teste%');
  console.log('Messages:', mData);
}
check();
