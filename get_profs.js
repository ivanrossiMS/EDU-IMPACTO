require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profs, error } = await supabase.from('usuarios').select('*').in('id', ['51eb2bca-6f18-41bd-b37d-8e1b62d6e775']);
  console.log("Profs in usuarios:", profs);
  
  const { data: profs2 } = await supabase.from('simulados_professores').select('*').in('id', ['51eb2bca-6f18-41bd-b37d-8e1b62d6e775']);
  console.log("Profs in simulados_professores:", profs2);
}
run();
