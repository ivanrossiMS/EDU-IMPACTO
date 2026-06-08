require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllOcorrencias() {
  console.log("Deletando todas as ocorrências...");
  // Supabase delete com .neq('id', 'something_impossible') apaga tudo
  const { data, error } = await supabase
    .from('ocorrencias')
    .delete()
    .neq('id', '0');

  if (error) {
    console.error("Erro ao deletar:", error);
  } else {
    console.log("Ocorrências deletadas com sucesso!");
  }
}

deleteAllOcorrencias();
