require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('system_users')
    .select('*')
    .eq('id', 'd7592809-9eff-4529-b6e1-044ed0e7e363')
    
  console.log("Error:", error)
  console.log("Data:", JSON.stringify(data, null, 2))
}

run()
