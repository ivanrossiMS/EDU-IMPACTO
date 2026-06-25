require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data: q } = await supabase.from('simulados_questoes').select('id').limit(1).single()
  if (q) {
    const { error } = await supabase.from('simulados_alternativas').insert([
      { id_questao: q.id, letra: 'A', texto: 'Teste A' }
    ])
    console.log("Insert result (no correta):", error ? error.message : 'SUCCESS')
  }
}
check()
