require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('system_users')
    .select('id, nome, perfil')
    
  console.log("Error:", error)
  console.log("Data count:", data ? data.length : 0)
  if (data && data.length > 0) {
    console.log("First user:", data[0])
    console.log("Looking for d7592809...", data.find(d => d.id === 'd7592809-9eff-4529-b6e1-044ed0e7e363'))
  }
}

run()
