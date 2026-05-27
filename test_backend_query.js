const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const loginInput = "99999999"
  const loginDigits = "99999999"
  const orQuery = `codigo.eq.${loginInput},dados->>cpf.eq.${loginDigits},celular.eq.${loginDigits}`
  const { data, error } = await supabaseAdmin
        .from('responsaveis')
        .select('id, nome, email, celular, codigo, telefone, dados')
        .or(orQuery)
        .limit(1)
  console.log(error || data);
}
check();
