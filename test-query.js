const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const orConditions = [];
  orConditions.push(`email.eq.nawally.loubet@hotmail.com`);
  orConditions.push(`nome.ilike."%Nawally Loubet%"`);
  
  const { data: resp, error: e1 } = await supabase.from('responsaveis').select('id, nome, email').or(orConditions.join(',')).limit(1).maybeSingle();
  console.log('Responsaveis:', resp, 'Error:', e1);
}
run();
