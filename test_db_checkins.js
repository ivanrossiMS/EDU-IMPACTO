require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: checkins } = await supabase.from('colaborador_checkin').select('*');
  console.log('Todos Checkins:', checkins);

  const { data: func } = await supabase.from('funcionarios').select('id, nome, email').limit(5);
  console.log('Funcionarios:', func);

  const { data: sysUsers } = await supabase.from('system_users').select('id, email, nome').limit(5);
  console.log('System Users:', sysUsers);
}
run();
