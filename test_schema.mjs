import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const req = await supabase.from('simulados_professores').insert({}).select()
  console.log('simulados_professores columns error:', req.error?.details || req.error?.message)
}
run()
