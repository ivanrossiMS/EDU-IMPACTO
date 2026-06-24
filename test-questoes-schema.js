require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
  const { data, error } = await supabase
    .from('simulados_questoes')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching:', error)
  } else {
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]))
    } else {
      // If empty, try to get columns using an intentional error or RPC
      const { data: d2, error: e2 } = await supabase.from('simulados_questoes').insert({}).select()
      console.log('Insert error helps find columns:', e2)
    }
  }
}
check()
