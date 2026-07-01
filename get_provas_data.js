require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: qData, error } = await supabase.from('provas_requisicoes').select('*, perfis(nome)').limit(2);
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(qData, null, 2));
}
run();
