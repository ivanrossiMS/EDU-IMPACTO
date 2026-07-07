require('dotenv').config({ path: '.env.local' });
const { createClient } = require(process.cwd() + '/node_modules/@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'bot@colegioimpacto.net',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      nome: 'Bot Teste',
      perfil: 'Coordenador',
      cargo: 'Coordenador'
    }
  });
  if (error) console.error(error);
  else console.log('Created bot user:', data.user.id);
}
run();
