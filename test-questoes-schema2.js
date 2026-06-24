require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'simulados_questoes' })
  console.log('RPC result:', data, error)
  // Let's do a raw SQL query if possible, but JS client doesn't support raw SQL easily without RPC.
  // We can try to select * and just not limit to 1, maybe it has data?
  const { data: d2 } = await supabase.from('simulados_questoes').select('*')
  if (d2 && d2.length > 0) {
    console.log('Columns from data:', Object.keys(d2[0]))
  } else {
    const { data: d3 } = await supabase.from('simulados_questoes_alternativas').select('*').limit(1)
    if(d3) console.log('Alternativas Table exists:', d3)
  }
}
check()
