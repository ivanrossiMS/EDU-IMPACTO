require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const readRecords = [{
    usuario_id: 'test_user_id',
    perfil: 'aluno',
    content_type: 'comunicado',
    content_id: 'test_com_id',
    read_at: new Date().toISOString()
  }];
  const { error } = await supabase.from('agenda_notification_reads').insert(readRecords);
  console.log("Insert error:", error);
}
check();
