const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const allGroupTerms = ['Direção'];
  const { data, error } = await supabase
      .from('agenda_grupos')
      .select('dados')
      .in('dados->>nome', allGroupTerms)
  console.log("Error:", error ? error.message : null);
  console.log("Data:", data);
}
test();
