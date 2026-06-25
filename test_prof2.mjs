import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const id = 'd7592809-9eff-4529-b6e1-044ed0e7e363'
  const prof = await supabase.from('simulados_professores').select('*').eq('id', id)
  console.log('simulados_professores:', prof.data?.length)
}
run()
