import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const req = await supabase.from('simulados_professores').insert({ id: 'd7592809-9eff-4529-b6e1-044ed0e7e363', nome: 'Ivam Rodrigues' }).select()
  console.log('simulados_professores error:', req.error)
}
run()
