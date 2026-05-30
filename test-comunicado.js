require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const row = {
    id: `COM-TEST-${Date.now()}`,
    titulo: 'Teste',
    texto: 'Corpo',
    autor: 'Admin',
    data: new Date().toISOString(),
    destino: 'todos',
    fixado: false,
    dados: {}
  };
  console.log("Upserting row...");
  const { data, error } = await supabase.from('comunicados').upsert([row]).select();
  console.log("Result:", { data, error });
}
run();
