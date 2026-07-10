const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  // Let's find Mariana Hegedus's ID
  const { data: cols } = await supabase.from('colaboradores').select('id, nome').ilike('nome', '%Mariana Hegedus%').limit(1);
  if (!cols || cols.length === 0) { console.log("Mariana not found"); return; }
  console.log("Found Mariana:", cols[0]);
  
  const { data, error } = await supabase.from('comunicados').select('id, titulo, destino, dados, created_at').eq('autor', cols[0].nome).order('created_at', { ascending: false }).limit(5);
  console.log("Error:", error ? error.message : null);
  console.log("Messages from Mariana:", JSON.stringify(data, null, 2));
}
test();
