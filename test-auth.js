const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log('Trying to login...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'direcao@colegioimpacto.net',
    password: 'wrong'
  });
  console.log('Result:', { data, error: error?.message });
})();
