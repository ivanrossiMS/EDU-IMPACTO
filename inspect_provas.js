require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: provas, error } = await supabase.from('provas').select('*').limit(1);
  console.log("Provas columns:", provas ? Object.keys(provas[0]) : error);

  const { data: reqs, error2 } = await supabase.from('provas_requisicoes').select('*').limit(1);
  console.log("Reqs columns:", reqs ? Object.keys(reqs[0] || {}) : error2);
}
run();
