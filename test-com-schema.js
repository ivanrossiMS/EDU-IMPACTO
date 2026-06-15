const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('comunicados').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0] || {}));
  
  const { data: d2, error: e2 } = await supabase.from('momentos').select('*').limit(1);
  if (e2) console.error(e2);
  else console.log(Object.keys(d2[0] || {}));
}
check();
