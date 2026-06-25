import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const req = await supabase.from('simulados_requisicoes').select('id_professor, id_disciplina, system_users!inner(nome)').limit(2)
  console.log('Inner join with system_users:', req.data, req.error)
}
run()
