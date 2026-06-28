require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase.from('configuracoes').select('chave, valor').in('chave', ['ad_banner', 'ad_config']);
  console.log("ANON KEY RESULT:", data, error);
}

test();
