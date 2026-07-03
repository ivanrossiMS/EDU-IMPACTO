const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function check() {
  const { data, error } = await supabase.from('provas_upload_requisicoes').select('*').limit(1);
  console.log(error || (data && data.length ? Object.keys(data[0]) : 'no data'));
}
check();
