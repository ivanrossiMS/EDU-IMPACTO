require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('configuracoes').select('dados').eq('chave', 'edu-sys-users').single();
  const users = data?.dados || [];
  const user = users.find(u => u.id === 'fc3bb60c-2d06-4b8c-b9b0-a6bb1bb24810');
  console.log('User in edu-sys-users:', !!user, user?.nome, user?.foto ? 'Has photo' : 'No photo');
  
  const user2 = users.find(u => u.nome?.includes('Ivan Rossi'));
  console.log('Ivan in edu-sys-users:', !!user2, user2?.id, user2?.nome, user2?.foto ? 'Has photo' : 'No photo');
}
check();
