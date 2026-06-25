import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const { data, error } = await supabase.rpc('get_foreign_keys', { table_name: 'simulados_questoes' })
  console.log('RPC error:', error)
}
run()
