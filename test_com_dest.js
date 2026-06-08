require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('comunicados')
    .select('id, titulo, dados')
    .eq('id', 'AD-COM-COLAB-1780808501095')
    .limit(1);
  console.log(JSON.stringify(data[0], null, 2));
}
run();
