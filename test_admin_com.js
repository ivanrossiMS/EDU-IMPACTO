require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'direcao@colegioimpacto.net',
    password: 'Mudar@123'
  });
  
  if (authError) {
    console.error("Login failed:", authError);
    return;
  }
  
  const token = authData.session.access_token;
  
  const response = await fetch("http://localhost:3000/api/comunicados?aluno_id=4697&turma_id=4%C2%BA%20ANO%20A", {
    headers: {
      "Cookie": `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=${encodeURIComponent(JSON.stringify([token]))}`
    }
  });
  
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text.substring(0, 200));
}
run();
