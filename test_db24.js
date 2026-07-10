const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: inserted, error: insertErr } = await supabase.from('comunicados').insert({
    titulo: 'Test Func',
    texto: 'Test',
    autor: 'Test',
    dados: { funcionariosIds: ["9999-1111"] }
  }).select('id').single();
  
  if (insertErr) { console.log(insertErr); return; }
  
  const cond = `dados->funcionariosIds.cs.["9999-1111"]`;
  const { data, error } = await supabase.from('comunicados').select('id').or(cond).eq('id', inserted.id);
  
  console.log("Error:", error ? error.message : null);
  console.log("Match:", data && data.length > 0);
  
  await supabase.from('comunicados').delete().eq('id', inserted.id);
}
test();
