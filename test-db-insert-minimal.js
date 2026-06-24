require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data: simData, error: simError } = await supabase.from('simulados').insert([{
    titulo: 'Test'
  }]).select().single()

  console.log("simError:", simError)
  console.log("simData:", simData)
  
  if (simData) {
     await supabase.from('simulados').delete().eq('id', simData.id)
  }
}

run()
