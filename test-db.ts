import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
  const turmas = ['Maternal I'] // replace with actual turma from DB
  
  const { data: allTurmas } = await supabase.from('turmas').select('id, nome, codigo')
  console.log('All turmas:', allTurmas?.slice(0, 3), '... total:', allTurmas?.length)

  // simulate notificationHelper logic
  const matchedTurmaIds = (allTurmas || [])
    .filter((t: any) => {
      const tId = String(t.id).toLowerCase()
      const tNome = String(t.nome || '').toLowerCase()
      const tCod = String(t.codigo || '').toLowerCase()
      return turmas.some(turma => {
        const tl = turma.toLowerCase().trim()
        return tl === tId || tl === tNome || tl === tCod || tNome.includes(tl) || tl.includes(tNome)
      })
    })
    .map((t: any) => String(t.id))

  const allSearchTerms = Array.from(new Set([...turmas, ...matchedTurmaIds]))
  console.log('allSearchTerms:', allSearchTerms)

  const { data: alunosTurma, error: alunosError } = await supabase.from('alunos').select('id, nome, turma').in('turma', allSearchTerms)
  console.log('Alunos found for these search terms:', alunosTurma?.length, alunosError)
  if (alunosTurma && alunosTurma.length > 0) {
     console.log('Sample aluno:', alunosTurma[0])
  }
}

test().catch(console.error)
