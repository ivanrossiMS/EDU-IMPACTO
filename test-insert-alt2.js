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
      { id_questao: q.id, letra: 'B', texto: 'Teste B', is_correta: true }
    ])
    console.log("Insert result (is_correta):", error ? error.message : 'SUCCESS')
  }
}
check()
