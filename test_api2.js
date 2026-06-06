const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data: alunos, error: errAlunos } = await supabase
      .from('alunos')
      .select('id, nome, foto, turma, data_nascimento')
      .not('data_nascimento', 'is', null)
  console.log("Alunos total:", alunos?.length)
  const june = alunos?.filter(a => a.data_nascimento?.split('-')[1] === '06')
  console.log("June:", june?.length)
}
run()
