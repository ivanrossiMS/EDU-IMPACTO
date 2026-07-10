require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const parentId = 'AD-COM-REL-COLAB-1783459346618-p3e1v';
  const { data: pData } = await supabase.from('comunicados').select('id, dados').eq('id', parentId).single();
  console.log('Parent:', pData.dados.dataEnvio, pData.dados.autorId);
  
  const { data: cData } = await supabase.from('comunicados').select('id, dados').ilike('id', 'AD-COM-REL-STU%').limit(5).order('created_at', { ascending: false });
  console.log('Child:', cData.map(c => ({ id: c.id, dataEnvio: c.dados.dataEnvio, autorId: c.dados.autorId })));
}
check();
