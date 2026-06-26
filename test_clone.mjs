import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: qData, error: qErr } = await supabase.from('simulados_questoes').select('*').limit(1)
  console.log("Sample question:", qData)
}
run()
