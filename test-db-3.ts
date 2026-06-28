import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchInChunks<T>(
  supabase: any,
  table: string,
  select: string,
  column: string,
  values: string[],
  chunkSize = 100
): Promise<T[]> {
  if (!values || values.length === 0) return []
  const results: T[] = []
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const { data, error } = await supabase.from(table).select(select).in(column, chunk)
    if (error) {
      console.error(`[fetchInChunks] Error fetching from ${table}:`, error.message)
    } else if (data) {
      results.push(...data)
    }
  }
  return results
}

async function test() {
  const turmas = ['1ª SÉRIE - ENSINO MÉDIO'] // A real turma name that exists
  
  const { data: allTurmas } = await supabase.from('turmas').select('id, nome, codigo')

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

  const alunosTurma = await fetchInChunks<any>(supabase, 'alunos', 'id, nome, turma', 'turma', allSearchTerms)
  console.log('Alunos found for these turmas:', alunosTurma.length)
  
  const allAlunoIds = alunosTurma.map(a => a.id)
  
  console.log('Fetching responsaveis for', allAlunoIds.length, 'alunos...')
  const vinculados = await fetchInChunks<any>(supabase, 'aluno_responsavel', 'aluno_id, responsavel_id', 'aluno_id', allAlunoIds)
  console.log('Vinculados found:', vinculados.length)

  const allResponsavelIds = new Set()
  vinculados.forEach(v => {
    if (v.responsavel_id) allResponsavelIds.add(String(v.responsavel_id))
  })
  console.log('Unique Responsavel IDs found:', allResponsavelIds.size)
}

test().catch(console.error)
