const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase URL or Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const queryFields = 'id, nome, matricula, status, data_nascimento, foto, turma, inadimplente, dados';
  
  const { data, error } = await supabase
    .from('alunos')
    .select(queryFields, { count: 'exact' })
    .order('nome', { ascending: true })
    .range(0, 9);
    
  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log("Success! Returned", data.length, "rows");
  }
}

test();
