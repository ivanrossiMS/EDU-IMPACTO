const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, foto')
    .eq('id', 4697);
  console.log("DATA:", data);
}
test();
