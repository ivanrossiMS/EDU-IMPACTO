require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const search = 'cec';
  const { data, error } = await supabase
    .from('alunos')
    .select('nome')
    .ilike('nome', `%${search}%`)
    .limit(10);
  console.log("ilike '%cec%':", data, error);

  const { data: data2, error: error2 } = await supabase
    .from('alunos')
    .select('nome')
    .ilike('nome', `%Cec%`)
    .limit(10);
  console.log("ilike '%Cec%':", data2, error2);
}
run();
