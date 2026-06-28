import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const { data: allTurmas } = await supabase.from('turmas').select('id, nome, codigo')
  console.log("Turmas:", allTurmas?.slice(0,3))
  
  const allGroupTerms = ['Maternal 1']
  const matchedTurmaIds = (allTurmas || [])
            .filter(t => {
              const tId = String(t.id).toLowerCase()
              const tNome = String(t.nome || '').toLowerCase()
              const tCod = String(t.codigo || '').toLowerCase()
              return allGroupTerms.some(turma => {
                const tl = turma.toLowerCase().trim()
                return tl === tId || tl === tNome || tl === tCod || tNome.includes(tl) || tl.includes(tNome)
              })
            })
            .map(t => String(t.id))
            
  console.log("Matched IDs:", matchedTurmaIds)
  const allSearchTerms = Array.from(new Set([...allGroupTerms, ...matchedTurmaIds]))
  console.log("All Search Terms:", allSearchTerms)
  
  const { data: alunosTurma } = await supabase.from('alunos').select('id, nome, turma').in('turma', allSearchTerms).limit(5)
  console.log("Alunos fetched by turma:", alunosTurma)
}
test().catch(console.error)
