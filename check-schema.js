const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: questoes } = await supabase.from('simulados_questoes').select('*').limit(1);
  const { data: alternativas, error: altError } = await supabase.from('simulados_alternativas').select('*').limit(1);
  
  console.log("QUESTOES", questoes);
  if (altError) {
    console.log("No alternativas table? Error:", altError.message);
  } else {
    console.log("ALTERNATIVAS", alternativas);
  }
}
test();
