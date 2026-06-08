require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('ocorrencias').select('*');
  console.log(data.map(d => ({ id: d.id, created_at: d.created_at, data: d.data })));
}
check();
