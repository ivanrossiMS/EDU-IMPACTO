const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: alunos, error: err1 } = await supabase.from('alunos').select('id, data_nascimento').not('data_nascimento', 'is', null).limit(10)
  const { data: profs, error: err2 } = await supabase.from('funcionarios').select('id, data_nascimento').not('data_nascimento', 'is', null).limit(10)
  
  console.log("Alunos:", alunos)
  console.log("Profs:", profs)
}
run()
