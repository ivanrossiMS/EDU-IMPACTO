require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: pData } = await supabase.from('comunicados').select('id, dados').ilike('id', 'AD-COM-REL-COLAB%').limit(1).order('created_at', { ascending: false });
  console.log('Parent:', pData[0].id, pData[0].dados.dataEnvio, pData[0].dados.autorId);
  
  const { data: cData } = await supabase.from('comunicados').select('id, dados').ilike('id', 'AD-COM-REL-STU%').eq('dados->>autorId', pData[0].dados.autorId).limit(2).order('created_at', { ascending: false });
  console.log('Child:', cData.map(c => ({ id: c.id, dataEnvio: c.dados.dataEnvio })));
}
check();
