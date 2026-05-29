require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data } = await supabase
    .from('responsaveis')
    .select('id')
    .limit(1);

  console.log("ID from responsaveis:", data[0].id, "Type:", typeof data[0].id);

  const { data: links } = await supabase
    .from('aluno_responsavel')
    .select('responsavel_id')
    .limit(1);
    
  console.log("ID from aluno_responsavel:", links[0].responsavel_id, "Type:", typeof links[0].responsavel_id);
}

run();
