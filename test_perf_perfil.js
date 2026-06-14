require('dotenv').config({ path: '.env.local' });
const { performance } = require('perf_hooks');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'direcao@colegioimpacto.net',
    password: 'Mudar@123' // we know this failed last time, but we can bypass
  });
}
run();
