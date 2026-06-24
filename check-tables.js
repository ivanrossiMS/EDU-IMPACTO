require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.from('simulados_requisicoes').select('id').limit(1)
  console.log("simulados_requisicoes:", error ? error.message : "Exists!")
  
  const { data: d2, error: e2 } = await supabase.from('simulados_questoes').select('id').limit(1)
  console.log("simulados_questoes:", e2 ? e2.message : "Exists!")
}

run()
