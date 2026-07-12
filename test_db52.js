const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabaseServer = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: reads } = await supabaseServer.from('agenda_notification_reads').select('*').eq('usuario_id', '12321321').order('created_at', { ascending: false }).limit(1);
  if (reads && reads.length > 0) {
    const r = reads[0];
    const { error } = await supabaseServer.from('agenda_notification_reads').insert({
      usuario_id: r.usuario_id,
      perfil: r.perfil,
      content_type: r.content_type,
      content_id: r.content_id,
      read_at: new Date().toISOString(),
      aluno_id: r.aluno_id + '_test'
    });
    console.log(error ? error.message : 'Insert succeeded');
    if (!error) {
       await supabaseServer.from('agenda_notification_reads').delete().eq('aluno_id', r.aluno_id + '_test');
    }
  }
}
main();
