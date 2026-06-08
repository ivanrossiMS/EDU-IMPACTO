require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('ocorrencias').select('*');
  console.log("Error:", error);
  // Just use regular sql if we can. We can't do arbitrary sql from supabase-js unless we have an rpc.
  // But maybe we have pg_policies in REST API? No.
}
check();
