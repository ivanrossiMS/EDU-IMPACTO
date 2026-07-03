const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  // Use Mariana's token if we can, but we don't have it.
  // With anon key, it will be anonymous.
  const { data, error } = await supabase.from('provas_upload').select('id, titulo, provas_upload_requisicoes(*)');
  console.log(JSON.stringify(data, null, 2));
}
run();
