import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: turmas } = await supabase.from('turmas').select('*').eq('id', '1479')
  console.log("Turma:", turmas[0])

  const { data: alunos } = await supabase.from('alunos').select('id, nome, turma').eq('turma', '1479')
  console.log("Alunos na Turma:", alunos.length)

  // check if there are other ways to reference a turma
  const { data: alunos2 } = await supabase.from('alunos').select('id, nome, turma').ilike('turma', '%1479%')
  console.log("Alunos na Turma ilike:", alunos2.length)
  
  const { data: alunos3 } = await supabase.from('alunos').select('id, nome, turma').ilike('turma', '%1º ANO A%')
  console.log("Alunos na Turma by name:", alunos3.length)
}
run()
