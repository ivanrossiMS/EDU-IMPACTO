import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function run() {
  const { data: q, error: e1 } = await supabase.from('simulados_questoes').select('*').limit(1).single()
  console.log("Original Q:", q)
  
  const { data: newQ, error: qErr } = await supabase.from('simulados_questoes').insert({
    id_simulado: q.id_simulado,
    id_disciplina: q.id_disciplina,
    id_professor: q.id_professor,
    enunciado: q.enunciado,
    ordem: q.ordem
  }).select().single()
  console.log("Insert Anon Error:", qErr)
}
run()
