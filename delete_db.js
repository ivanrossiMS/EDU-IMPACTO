const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { error } = await supabase.from('configuracoes').delete().ilike('chave', '%censo%')
  if (error) console.error("Error deleting config:", error)
  else console.log("Deleted censo configs.")
  
  // also let's drop the tables if they exist
  console.log("To drop tables, we'd need postgres client, but this removes the frontend triggers.")
}
run()
