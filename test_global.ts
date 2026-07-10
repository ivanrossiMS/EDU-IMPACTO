import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function run() {
  const { data, error } = await supabase.from('agenda_grupos').select('*').limit(1)
  console.log(error)
  console.log(data)
}
run().catch(console.error)
