require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('configuracoes').select('dados').eq('chave', 'usuarios').single();
  const users = data?.dados || [];
  const user = users.find(u => u.id === 'fc3bb60c-2d06-4b8c-b9b0-a6bb1bb24810');
  console.log('User in config:', user);
}
check();
