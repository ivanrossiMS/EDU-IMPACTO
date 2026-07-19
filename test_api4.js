const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // USE ANON KEY

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: pesquisa, error } = await supabase
      .from('gp_pesquisas')
      .select(`
        *,
        gp_pesquisa_respostas (*)
      `)
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();
  console.log("ANON DATA:", JSON.stringify(pesquisa, null, 2));
  console.log("ANON ERROR:", error);
}
run();
