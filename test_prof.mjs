import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const id = 'd7592809-9eff-4529-b6e1-044ed0e7e363'
  
  const req = await supabase.from('simulados_requisicoes').select('*').eq('id_professor', id)
  console.log('simulados_requisicoes:', req.data?.length)
  
  const sys = await supabase.from('system_users').select('*').eq('id', id)
  console.log('system_users:', sys.data?.length)
  
  const prof = await supabase.from('professores').select('*').eq('id', id)
  console.log('professores:', prof.data?.length, prof.error)
}
run()
