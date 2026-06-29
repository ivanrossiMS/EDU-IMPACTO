require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('agenda_cobrancas_destinatarios')
    .select('*')
    .not('asaas_payment_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  console.log("Error:", error);
  console.log("Latest payments with asaas_payment_id:", data.map(d => ({id: d.id, asaas_payment_id: d.asaas_payment_id, status: d.status, created_at: d.created_at})));
}
check();
