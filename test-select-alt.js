require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data, error } = await supabase.from('simulados_alternativas').select('*').limit(1)
  console.log("Keys in row:", data && data.length ? Object.keys(data[0]) : error)
}
check()
