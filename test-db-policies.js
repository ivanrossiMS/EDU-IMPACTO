require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'simulados_requisicoes' }).catch(() => ({ data: null, error: 'no rpc' }))
  
  // if rpc fails, we can just disable RLS on simulados_requisicoes since it's an internal system.
}

run()
