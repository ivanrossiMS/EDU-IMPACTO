require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
  const { error } = await supabase.from('simulados_alternativas').insert({}).select()
  console.log('simulados_alternativas insert error:', error)
  const { error: e2 } = await supabase.from('simulados_questoes_alternativas').insert({}).select()
  console.log('simulados_questoes_alternativas insert error:', e2)
}
check()
