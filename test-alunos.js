const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, foto')
    .eq('id', 4697);
  console.log("DATA:", data);
  if (data && data.length > 0) console.log("ID TYPE:", typeof data[0].id);
}
test();
