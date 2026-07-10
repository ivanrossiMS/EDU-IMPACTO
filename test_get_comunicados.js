require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: dataCom } = await supabase.from('comunicados').select('*').limit(5);
  const ids = dataCom.map(c => String(c.id));
  const { data: reads } = await supabase.from('agenda_notification_reads').select('*').in('content_id', ids);
  console.log("Reads found:", reads.length);
  
  // mock the route logic
  dataCom.forEach(row => {
    const merged = { ...row, ...(row.dados || {}) };
    merged.leituras = merged.leituras || {};
    const itemReads = reads.filter(r => r.content_id === String(row.id));
    itemReads.forEach(r => {
      merged.leituras[r.usuario_id] = r.read_at;
    });
    console.log("Leituras for", row.id, merged.leituras);
  });
}
check();
