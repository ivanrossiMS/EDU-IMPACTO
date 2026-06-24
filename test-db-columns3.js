require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase.from('simulados').select('*').limit(1)
  console.log("simData:", data)

  // Wait, I can't easily see columns if there's no data. I'll just query information_schema if I can use psql.
}

run()
