require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const nome = "Maria Auxiliadora de Araújo Honório Vilela";
  const email = "auxiliadorahonorio41@gmail.com";
  let fallbackQuery = supabase.from('alunos').select('id,nome,responsavel,responsavel_financeiro,dados').or(`responsavel.ilike.${nome},responsavel_financeiro.ilike.${nome},emailResponsavel.ilike.${email},email_responsavel.ilike.${email}`);
  const { data } = await fallbackQuery;
  console.log(JSON.stringify(data, null, 2));
}
run();
