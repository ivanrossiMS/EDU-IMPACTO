require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const payload = { 
    id: 'default', 
    modelo_pdf_url: '', 
    modelo_pdf_outras_paginas_url: '',
    provas_modelo_pdf_url: '',
    provas_modelo_pdf_outras_paginas_url: '',
    updated_at: new Date().toISOString() 
  }
  
  const { data, error } = await supabase.from('simulados_configuracoes').upsert(payload);
  console.log("Error:", JSON.stringify(error, null, 2));
}
run();
