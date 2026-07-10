require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('comunicados').select('titulo, dados').limit(3).order('created_at', { ascending: false });
  console.log(JSON.stringify(data, null, 2));
}
check();
