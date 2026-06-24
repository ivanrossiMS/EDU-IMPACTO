require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const tables = [
  'simulados_bimestres',
  'simulados_disciplinas',
  'simulados',
  'simulados_requisicoes',
  'simulados_questoes',
  'simulados_imagens',
  'simulados_alternativas',
  'simulados_logs'
]

async function run() {
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1)
    console.log(t, ":", error ? "MISSING (" + error.message + ")" : "EXISTS")
  }
}

run()
