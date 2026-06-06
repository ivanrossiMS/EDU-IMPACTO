const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: configs } = await supabase.from('configuracoes').select('*').ilike('chave', '%censo%')
  console.log("Configuracoes:", configs?.map(c => c.chave))
}
run()
