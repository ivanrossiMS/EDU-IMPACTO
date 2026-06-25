require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data, error } = await supabase.rpc('get_policies') // if it exists
  console.log("RPC get_policies?", !!error)
  
  // Actually we can query pg_policies if we run a custom sql script via postgres or postgrest if exposed.
  // We can just fetch the bucket details:
  const { data: b, error: e2 } = await supabase.storage.getBucket('comunicados-midia')
  console.log("Bucket details:", b, e2)
}
check()
