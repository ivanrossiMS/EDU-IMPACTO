import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const q = 'teste2@teste2'
  const safeQ = q.replace(/"/g, '""');
  const orCondition = `email.eq."${safeQ}",codigo.eq."${safeQ}"`;
  
  const { data, error } = await supabase.from('responsaveis').select('id, nome, email, codigo').or(orCondition);
  console.log('Result:', data, error)
}
run()
