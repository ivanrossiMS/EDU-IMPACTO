const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  console.time('fetchAlunos')
  const { data: alunos } = await supabase
      .from('alunos')
      .select('id, nome, turma, data_nascimento')
      .not('data_nascimento', 'is', null)
  console.timeEnd('fetchAlunos')

  const june = alunos?.filter(a => a.data_nascimento?.split('-')[1] === '06')
  const juneIds = june.map(a => a.id)

  console.time('fetchFotos')
  const { data: fotos } = await supabase
      .from('alunos')
      .select('id, foto')
      .in('id', juneIds)
  console.timeEnd('fetchFotos')
}
run()
