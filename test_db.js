require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('agenda_cobrancas_destinatarios')
    .select('*')
    .not('asaas_payment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
