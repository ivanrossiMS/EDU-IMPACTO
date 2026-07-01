require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase.from('simulados_disciplinas').insert([
    {
      nome: 'Teste Error',
      cor: '#fff',
      professores_ids: ["test_id"],
      quantidade_questoes: 10,
      segmento: 'Ens. Médio'
    }
  ]);
  
  if (error) {
    console.error('ERROR JSON:', JSON.stringify(error, null, 2));
    console.error('ERROR OBJECT:', error);
  } else {
    console.log('SUCCESS:', data);
    // clean up
    await supabase.from('simulados_disciplinas').delete().eq('nome', 'Teste Error');
  }
}

test();
